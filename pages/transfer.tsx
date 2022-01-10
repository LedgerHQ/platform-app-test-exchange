import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  FeesLevel,
  FAMILIES,
  EthereumTransaction,
  ExchangeType,
} from "@ledgerhq/live-app-sdk";

import type {
  Currency,
  Account,
  BitcoinTransaction,
  RawSignedTransaction,
} from "@ledgerhq/live-app-sdk";

import { BigNumber } from "bignumber.js";

import styles from "../styles/Home.module.css";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";
import { useApi } from "../src/providers/LedgerLiveSDKProvider";
import getData from "../src/getData";

/**
 * FIXME: for now only these currencies are handled for test purposes.
 * Would need to generate test config for other assets to expend the list
 */
const AVAILABLE_CURRENCIES = ["bitcoin", "ethereum"];

type Request = {
  provider: string;
  amountFrom: string;
  from: string;
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
  refundAddress: "",
  deviceTransactionId: "",
};

// Test partner name
const provider = "TEST_FUND";

/**
 * This poc could be extended in order to support some minimal validation of
 * the inputs, but my take on it is that it would blurry the bottom-line and
 * not contribute much to the discussion.
 */
const Transfer = ({
  exchangeType,
}: {
  exchangeType: ExchangeType.FUND | ExchangeType.SELL;
}) => {
  const api = useApi();

  const exchangeTypeKey = ExchangeType[exchangeType];

  const [currencies, setCurrencies] = useState<Currency[]>();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<Account>();
  const [feesStrategy, setFeesStrategy] = useState(FeesLevel.Slow);
  const [data, setData] = useState<Data>();
  const [operation, setOperation] = useState<RawSignedTransaction>();

  const [request, setRequest] = useState<Request>(initialRequest);

  useEffect(() => {
    api.listCurrencies().then((sdkCurrencies) => setCurrencies(sdkCurrencies));
  }, [api]);

  const requestFrom = useCallback(() => {
    api.requestAccount({ currencies: AVAILABLE_CURRENCIES }).then((account) => {
      setFromAccount(account);
      console.log(account);
    });
  }, [api]);

  const requestNonce = useCallback(() => {
    api.startExchange({ exchangeType }).then(setNonce);
  }, [api, exchangeType]);

  // request fund or sell from partner using data in request, to get "binaryPayload" and "signature"
  const requestData = useCallback(() => {
    const currency = currencies?.find(
      (cur) => cur.id === fromAccount?.currency
    );

    if (!currency) {
      throw new Error("currency not found");
    }

    const amountToFund = parseCurrencyUnit(
      currency.units[0],
      request.amountFrom
    );

    const newData = getData({
      exchangeType: exchangeType,
      txId: request.deviceTransactionId,
      ammount: amountToFund.toNumber(),
      ticker: currency.ticker,
    });
    setData(newData);
  }, [request, currencies, fromAccount, exchangeType]);

  const completeExchange = useCallback(() => {
    if (!data) {
      throw new Error("'data' is undefined");
    }

    if (!fromAccount) {
      throw new Error("'fromAccount' is undefined");
    }

    // FIXME: need to genetare a tx based on family (currency)
    const transaction: BitcoinTransaction | EthereumTransaction = {
      amount: new BigNumber(data.amountExpectedFrom),
      recipient: data.payinAddress,
      // FIXME: Hacky as hell
      family: fromAccount.currency as FAMILIES.BITCOIN | FAMILIES.ETHEREUM,
    };

    // Receive an operation object with the broadcasted transaction information including tx hash.
    api
      .completeExchange({
        provider,
        fromAccountId: fromAccount.id,
        transaction,
        binaryPayload: data.binaryPayload,
        signature: data.signature,
        feesStrategy,
        exchangeType: exchangeType,
      })
      .then(setOperation);
  }, [api, fromAccount, data, feesStrategy, exchangeType]);

  // Progressively build the request object that will be used to request a fund or sell with partner
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
      <div className={styles.header}>
        <button onClick={requestFrom}>{"From"}</button>
        <input
          type="number"
          disabled={!fromAccount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="amount"
        />
        <select
          disabled={!fromAccount}
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

        <button disabled={!nonce} onClick={requestData}>
          {`Request ${exchangeTypeKey}`}
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
            <h2>{`Local ${exchangeTypeKey} data`}</h2>
            <pre>{JSON.stringify(request, null, 2)}</pre>
          </>
        )}
        {data && (
          <>
            <h2>{`Provider ${exchangeTypeKey} data`}</h2>
            <pre>
              {JSON.stringify(
                {
                  ...data,
                  binaryPayload: data.binaryPayload.toString("hex"),
                  signature: data.signature.toString("hex"),
                },
                null,
                2
              )}
            </pre>
          </>
        )}
      </div>
    </div>
  );
};

export default Transfer;
