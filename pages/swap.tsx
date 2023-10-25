import { useWalletAPIClient } from "@ledgerhq/wallet-api-client-react";
import {
  Account,
  Currency,
  ExchangeComplete,
  Transaction,
} from "@ledgerhq/wallet-api-core";
import axios from "axios";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";
import styles from "../styles/Home.module.css";

const AVAILABLE_CURRENCIES = [
  "bitcoin",
  "ethereum",
  "dogecoin",
  "stellar",
  "ripple",
];

type FeeStrategies = ExchangeComplete["params"]["feeStrategy"];

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

/**
 * This poc could be extended in order to support some minimal validation of
 * the inputs, but my take on it is that it would blurry the bottom-line and
 * not contribute much to the discussion.
 */
export default function Swap() {
  const { client } = useWalletAPIClient();

  const provider = "changelly";

  const [currencies, setCurrencies] = useState<Currency[]>();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<Account>();
  const [toAccount, setToAccount] = useState<Account>();
  const [rates, setRates] = useState();
  const [feeStrategy, setFeeStrategy] = useState<FeeStrategies>("SLOW");
  const [data, setData] = useState<any>({});
  const [transactionHash, setTransactionHash] = useState<string>();

  const [request, setRequest] = useState<Request>(initialRequest);

  useEffect(() => {
    client?.currency
      .list()
      .then((sdkCurrencies) => setCurrencies(sdkCurrencies));
  }, [client?.currency]);

  const requestFrom = useCallback(() => {
    client?.account
      .request({ currencyIds: AVAILABLE_CURRENCIES })
      .then((account) => {
        setFromAccount(account);
        setToAccount(undefined);
      });
  }, [client?.account]);

  const requestTo = useCallback(() => {
    client?.account
      .request({
        currencyIds: AVAILABLE_CURRENCIES.filter(
          (c) => c !== fromAccount?.currency
        ),
      })
      .then(setToAccount);
  }, [client?.account, fromAccount?.currency]);

  const requestNonce = useCallback(() => {
    client?.exchange.start("SWAP").then(setNonce);
  }, [client?.exchange]);

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
      currency.decimals,
      data.amountExpectedFrom.toString(10)
    );

    const transaction: Partial<Transaction> = {
      amount,
      recipient: data.payinAddress,
      family: currency.type === "CryptoCurrency" ? currency.family : "ethereum", // not the best but default to eth for token currency, maybe we should add parentFamily in TokenCurrency
    };

    // Add currency specific payinExtraId
    if (transaction.family === "ripple") {
      transaction.tag = data.payinExtraId;
    }

    if (transaction.family === "stellar") {
      transaction.memoValue = data.payinExtraId;
      transaction.memoType = "MEMO_TEXT";
    }

    // Receive an operation object with the broadcasted transaction information including tx hash.
    client?.exchange
      .completeSwap({
        provider,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        transaction: transaction as Transaction,
        binaryPayload: data.binaryPayload,
        signature: data.signature,
        feeStrategy,
        swapId: "",
        rate: 0,
      })
      .then(setTransactionHash);
  }, [
    fromAccount,
    toAccount,
    currencies,
    data.amountExpectedFrom,
    data.payinAddress,
    data.binaryPayload,
    data.signature,
    data.payinExtraId,
    client?.exchange,
    feeStrategy,
  ]);

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
          onChange={(event) =>
            setFeeStrategy(event.target.value as FeeStrategies)
          }
          placeholder="fees"
        >
          <option value={"SLOW"}>Slow</option>
          <option value={"MEDIUM"}>Medium</option>
          <option value={"FAST"}>Fast</option>
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
        {transactionHash && (
          <>
            <h2>{"Broadcasted transactionHash"}</h2>
            <pre>{transactionHash}</pre>
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
