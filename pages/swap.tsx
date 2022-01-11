import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import axios from "axios";
import LedgerLiveApi, { FAMILIES } from "@ledgerhq/live-app-sdk";
import { WindowMessageTransport } from "@ledgerhq/live-app-sdk";
import styles from "../styles/Home.module.css";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";

// FIXME: Fix types + use SDKProvider

const AVAILABLE_CURRENCIES = ["bitcoin", "ethereum", "dogecoin", "stellar"];

const getFamilyFromCurrency = (currency: string) => {
  switch (currency) {
    case "bitcoin":
    case "dogecoin":
      return FAMILIES.BITCOIN;

    case "ethereum":
      return FAMILIES.ETHEREUM;

    case "stellar":
      return FAMILIES.STELLAR;

    default:
      throw new Error(`Family '${currency}' not supported`);
  }
};

/**
 * This poc could be extended in order to support some minimal validation of
 * the inputs, but my take on it is that it would blurry the bottom-line and
 * not contribute much to the discussion.
 */
export default function Swap() {
  const api = useRef();

  const provider = "changelly";

  const [currencies, setCurrencies] = useState();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState();
  const [toAccount, setToAccount] = useState();
  const [rates, setRates] = useState();
  const [feesStrategy, setFeesStrategy] = useState("medium");
  const [swap, setSwap] = useState();
  const [operation, setOperation] = useState();

  const [request, setRequest] = useState();

  useEffect(() => {
    const llapi = new LedgerLiveApi(new WindowMessageTransport());

    llapi.connect();
    llapi
      .listCurrencies()
      .then((sdkCurrencies) => setCurrencies(sdkCurrencies))
      .then(() => {
        api.current = llapi;
        window.api = api.current;
      });

    return () => {
      api.current = null;
      void llapi.disconnect();
    };
  }, []);

  const requestFrom = useCallback(() => {
    api.current
      .requestAccount({ currencies: AVAILABLE_CURRENCIES })
      .then((account) => {
        setFromAccount(account);
        console.log(account);
        setToAccount();
      });
  }, []);

  const requestTo = useCallback(() => {
    api.current
      .requestAccount({
        currencies: AVAILABLE_CURRENCIES.filter(
          (c) => c !== fromAccount?.currency
        ),
      })
      .then(setToAccount);
  }, [fromAccount?.currency]);

  const requestNonce = useCallback(() => {
    //NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
    api.current.startExchange({ exchangeType: 0x00 }).then(setNonce);
  }, []);

  const requestSwap = useCallback(() => {
    axios
      .post("https://swap.ledger.com/v3/swap", request)
      .then((res) => {
        setSwap(res.data);
      })
      .catch((e) => {
        console.log(e);
        alert("Something went wrong, check console");
      });
  }, [request]);

  const completeExchange = useCallback(() => {
    const currency = currencies.find((cur) => cur.id === fromAccount?.currency);

    if (!currency) {
      throw new Error("currency not found");
    }

    const amount = parseCurrencyUnit(
      currency.units[0],
      swap.amountExpectedFrom.toString(10)
    );

    const transaction = {
      amount,
      recipient: swap.payinAddress,
      mode: "send",
      feesStrategy,
      family: getFamilyFromCurrency(fromAccount.currency),
    };

    // Add currency specific payinExtraId
    if (swap.from === "ripple") transaction.tag = swap.payinExtraId;
    if (swap.from === "stellar") {
      transaction.memoValue = swap.payinExtraId;
      transaction.memoType = "MEMO_TEXT";
    }

    // Receive an operation object with the broadcasted transaction information including tx hash.
    api.current
      .completeExchange({
        provider,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        transaction,
        binaryPayload: swap.binaryPayload,
        signature: swap.signature,
        feesStrategy,
        //NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
        exchangeType: 0x00,
      })
      .then(setOperation);
  }, [fromAccount, toAccount, swap, feesStrategy, currencies]);

  const requestRates = useCallback(() => {
    const { from, to, amountFrom } = request;
    axios
      .post("https://swap.ledger.com/v3/rate", { from, to, amountFrom })
      .then((res) => {
        // Filter to changelly floating, to avoid wyre confusion when ip check doesnt work
        const maybeRates = res.data?.filter(
          (rate) =>
            rate.provider === "changelly" && rate.tradeMethod === "float"
        );
        setRates(maybeRates || []);
      });
  }, [request]);

  // Progressively build the request object that will be used to request a swap with changelly
  useEffect(() => {
    setRequest({
      provider,
      amountFrom: amount,
      from: fromAccount?.currency || "",
      to: toAccount?.currency || "",
      address: toAccount?.address || "",
      refundAddress: fromAccount?.address || "",
      deviceTransactionId: nonce,
    });
  }, [fromAccount, toAccount, nonce, amount]);

  return (
    <div>
      <Head>
        <title>Minimal Exchange Platform App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.header}>
        <button onClick={requestFrom}>{"From"}</button>
        <button onClick={requestTo}>{"To"}</button>
        <input
          disabled={!fromAccount || !toAccount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="amount"
        />
        <select
          disabled={!fromAccount || !toAccount}
          onChange={(event) => setFeesStrategy(event.target.value)}
          placeholder="fees"
        >
          <option value="slow">Slow</option>
          <option default value="medium">
            Medium
          </option>
          <option value="fast">Fast</option>
        </select>
        <button disabled={!amount} onClick={requestNonce}>
          {"Start"}
        </button>
        <button disabled={!nonce} onClick={requestRates}>
          {"Rates"}
        </button>
        <button disabled={!rates} onClick={requestSwap}>
          {"Request Swap"}
        </button>
        <button disabled={!swap} onClick={completeExchange}>
          {"Complete"}
        </button>
      </div>
      {/* Debug information */}
      <div className={styles.main}>
        {operation && (
          <>
            <h2>{"Broadcasted Operation"}</h2>
            <pre>{JSON.stringify(operation, null, 2)}</pre>
          </>
        )}
        {request && (
          <>
            <h2>{"Local swap data"}</h2>
            <pre>{JSON.stringify(request, null, 2)}</pre>
          </>
        )}
        {swap && (
          <>
            <h2>{"Provider swap data"}</h2>
            <pre>{JSON.stringify(swap, null, 2)}</pre>
          </>
        )}
        {rates && rates[0] && (
          <>
            <h2>{"Provider swap rates"}</h2>
            <pre>{JSON.stringify(rates[0], null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
