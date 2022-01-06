import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import LedgerLiveApi from "@ledgerhq/live-app-sdk";
import { WindowMessageTransport } from "@ledgerhq/live-app-sdk";
import { BigNumber } from "bignumber.js";

import styles from "../styles/Home.module.css";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";
import getFundData from "../src/fund/fundData";

// FIXME: first test with BTC, then add ETH (will need to update getFundData function)
const AVAILABLE_CURRENCIES = ["bitcoin", "ethereum"];

//NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
const EXCHANGE_TYPE = 0x02;

/**
 * This poc could be extended in order to support some minimal validation of
 * the inputs, but my take on it is that it would blurry the bottom-line and
 * not contribute much to the discussion.
 */
const Fund = () => {
  const api = useRef();

  //   FIXME: need fund partner name
  const provider = "TEST_FUND";

  const [currencies, setCurrencies] = useState();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState();
  const [feesStrategy, setFeesStrategy] = useState("medium");
  const [fund, setFund] = useState();
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
      });
  }, []);

  const requestNonce = useCallback(() => {
    api.current.startExchange({ exchangeType: EXCHANGE_TYPE }).then(setNonce);
  }, []);

  const requestFund = useCallback(() => {
    // FIXME: request fund from partner using data in request, to get "binaryPayload" and "signature"

    const currency = currencies.find((cur) => cur.id === fromAccount?.currency);

    if (!currency) {
      throw new Error("currency not found");
    }

    const amountToFund = parseCurrencyUnit(
      currency.units[0],
      request.amountFrom.toString(10)
    );

    console.log({ currency });

    const newFund = getFundData({
      txId: request.deviceTransactionId,
      ammount: amountToFund.toNumber(),
      ticker: currency.ticker,
    });
    setFund(newFund);
  }, [request, currencies, fromAccount]);

  const completeExchange = useCallback(() => {
    const transaction = {
      amount: new BigNumber(fund.amountExpectedFrom),
      recipient: fund.payinAddress,
      family: fromAccount.currency,
    };

    // Receive an operation object with the broadcasted transaction information including tx hash.
    api.current
      .completeExchange({
        provider,
        fromAccountId: fromAccount.id,
        transaction,
        binaryPayload: fund.binaryPayload,
        signature: fund.signature,
        feesStrategy,
        exchangeType: EXCHANGE_TYPE,
      })
      .then(setOperation);
  }, [fromAccount, fund, feesStrategy]);

  // Progressively build the request object that will be used to request a fund with partner
  // FIXME: what is the request format for a fund? IS there a "fundApi" similar to "swapApi"?
  useEffect(() => {
    setRequest({
      provider,
      amountFrom: amount,
      from: fromAccount?.currency || "",
      refundAddress: fromAccount?.address || "",
      deviceTransactionId: nonce,
    });
  }, [fromAccount, nonce, amount]);

  return (
    <div>
      <Head>
        <title>Minimal Exchange Platform App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.header}>
        <button onClick={requestFrom}>{"From"}</button>
        <input
          disabled={!fromAccount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="amount"
        />
        <select
          disabled={!fromAccount}
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

        <button disabled={!nonce} onClick={requestFund}>
          {"Request Fund"}
        </button>
        <button disabled={!fund} onClick={completeExchange}>
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
            <h2>{"Local fund data"}</h2>
            <pre>{JSON.stringify(request, null, 2)}</pre>
          </>
        )}
        {fund && (
          <>
            <h2>{"Provider fund data"}</h2>
            <pre>{JSON.stringify(fund, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
};

export default Fund;
