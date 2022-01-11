import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";
import {
  Account,
  BitcoinTransaction,
  Currency,
  EthereumTransaction,
  ExchangeType,
  FAMILIES,
  FeesLevel,
  RawSignedTransaction,
  RippleTransaction,
  StellarTransaction,
  Transaction,
} from "@ledgerhq/live-app-sdk";
import styles from "../styles/Home.module.css";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";
import { useApi } from "../src/providers/LedgerLiveSDKProvider";

const AVAILABLE_CURRENCIES = [
  "bitcoin",
  "ethereum",
  "dogecoin",
  "stellar",
  "ripple",
];

const exchangeType = ExchangeType.SWAP;

type Request = {
  provider: string;
  amountFrom: string;
  from: string;
  to: string;
  address: string;
  refundAddress: string;
  deviceTransactionId: string;
};

type Data = {
  binaryPayload: Buffer;
  signature: Buffer;
  amountExpectedFrom: number;
  payinAddress: string;
};

const initialRequest: Request = {
  provider: "",
  amountFrom: "",
  from: "",
  to: "",
  address: "",
  refundAddress: "",
  deviceTransactionId: "",
};

const getFamilyFromCurrency = (currency: string) => {
  switch (currency) {
    case "bitcoin":
    case "dogecoin":
      return FAMILIES.BITCOIN;

    case "ethereum":
      return FAMILIES.ETHEREUM;

    case "stellar":
      return FAMILIES.STELLAR;

    case "ripple":
      return FAMILIES.RIPPLE;

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
  const api = useApi();

  const provider = "changelly";

  const [currencies, setCurrencies] = useState<Currency[]>();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<Account>();
  const [toAccount, setToAccount] = useState<Account>();
  const [rates, setRates] = useState();
  const [feesStrategy, setFeesStrategy] = useState(FeesLevel.Slow);
  const [data, setData] = useState<any>();
  const [operation, setOperation] = useState<RawSignedTransaction>();

  const [request, setRequest] = useState<Request>(initialRequest);

  useEffect(() => {
    api.listCurrencies().then((sdkCurrencies) => setCurrencies(sdkCurrencies));
  }, [api]);

  const requestFrom = useCallback(() => {
    api.requestAccount({ currencies: AVAILABLE_CURRENCIES }).then((account) => {
      setFromAccount(account);
      setToAccount(undefined);
    });
  }, [api]);

  const requestTo = useCallback(() => {
    api
      .requestAccount({
        currencies: AVAILABLE_CURRENCIES.filter(
          (c) => c !== fromAccount?.currency
        ),
      })
      .then(setToAccount);
  }, [api, fromAccount?.currency]);

  const requestNonce = useCallback(() => {
    //NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
    api.startExchange({ exchangeType }).then(setNonce);
  }, [api]);

  const requestSwap = useCallback(() => {
    axios
      .post("https://swap.ledger.com/v3/swap", request)
      .then((res) => {
        setData(res.data);
      })
      .catch((e) => {
        console.log(e);
        alert("Something went wrong, check console");
      });
  }, [request]);

  const completeExchange = useCallback(() => {
    if (!fromAccount) {
      throw new Error("fromAccount not found");
    }
    if (!toAccount) {
      throw new Error("toAccount not found");
    }

    const currency = currencies?.find((cur) => cur.id === fromAccount.currency);

    if (!currency) {
      throw new Error("currency not found");
    }

    const amount = parseCurrencyUnit(
      currency.units[0],
      data.amountExpectedFrom.toString(10)
    );

    const transaction: Partial<
      | BitcoinTransaction
      | EthereumTransaction
      | StellarTransaction
      | RippleTransaction
    > = {
      amount,
      recipient: data.payinAddress,
      family: getFamilyFromCurrency(currency.id),
    };

    // Add currency specific payinExtraId
    if (transaction.family === FAMILIES.RIPPLE) {
      transaction.tag = data.payinExtraId;
    }

    if (transaction.family === FAMILIES.STELLAR) {
      transaction.memoValue = data.payinExtraId;
      transaction.memoType = "MEMO_TEXT";
    }

    // Receive an operation object with the broadcasted transaction information including tx hash.
    api
      .completeExchange({
        provider,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        transaction: transaction as Transaction,
        binaryPayload: data.binaryPayload,
        signature: data.signature,
        feesStrategy,
        //NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
        exchangeType: 0x00,
      })
      .then(setOperation);
  }, [api, fromAccount, toAccount, data, feesStrategy, currencies]);

  const requestRates = useCallback(() => {
    const { from, to, amountFrom } = request;
    axios
      .post("https://swap.ledger.com/v3/rate", { from, to, amountFrom })
      .then((res) => {
        // Filter to changelly floating, to avoid wyre confusion when ip check doesnt work
        const maybeRates = res.data?.filter(
          (rate: any) =>
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
          onChange={(event) => setFeesStrategy(event.target.value as FeesLevel)}
          placeholder="fees"
        >
          <option value={FeesLevel.Slow}>Slow</option>
          <option value={FeesLevel.Medium}>Medium</option>
          <option value={FeesLevel.Fast}>Fast</option>
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
        <button disabled={!data} onClick={completeExchange}>
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
        {data && (
          <>
            <h2>{"Provider swap data"}</h2>
            <pre>{JSON.stringify(data, null, 2)}</pre>
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
