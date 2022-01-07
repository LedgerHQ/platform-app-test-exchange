import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  FeesLevel,
  FAMILIES,
  EthereumTransaction,
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
import getFundData from "../src/fund/fundData";
import { useApi } from "../src/providers/LedgerLiveSDKProvider";

// FIXME: first test with BTC, then add ETH (will need to update getFundData function)
const AVAILABLE_CURRENCIES = ["bitcoin", "ethereum"];

//NB the exchangeType determines which flow we will follow (swap: 0x00, sell: 0x01, fund: 0x02)
const EXCHANGE_TYPE = 0x02;

type FundRequest = {
  provider: string;
  amountFrom: string;
  from: string;
  refundAddress: string;
  deviceTransactionId: string;
};

type FundData = {
  binaryPayload: string;
  signature: string;
  amountExpectedFrom: number;
  payinAddress: string;
};

const initialRequest: FundRequest = {
  provider: "",
  amountFrom: "",
  from: "",
  refundAddress: "",
  deviceTransactionId: "",
};

// Test fund partner name
const provider = "TEST_FUND";

/**
 * This poc could be extended in order to support some minimal validation of
 * the inputs, but my take on it is that it would blurry the bottom-line and
 * not contribute much to the discussion.
 */
const Fund = () => {
  const api = useApi();

  const [currencies, setCurrencies] = useState<Currency[]>();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<Account>();
  const [feesStrategy, setFeesStrategy] = useState(FeesLevel.Slow);
  const [fund, setFund] = useState<FundData>();
  const [operation, setOperation] = useState<RawSignedTransaction>();

  const [request, setRequest] = useState<FundRequest>(initialRequest);

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
    api.startExchange({ exchangeType: EXCHANGE_TYPE }).then(setNonce);
  }, [api]);

  const requestFund = useCallback(() => {
    // FIXME: request fund from partner using data in request, to get "binaryPayload" and "signature"

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

    const newFund = getFundData({
      txId: request.deviceTransactionId,
      ammount: amountToFund.toNumber(),
      ticker: currency.ticker,
    });
    setFund(newFund);
  }, [request, currencies, fromAccount]);

  const completeExchange = useCallback(() => {
    if (!fund) {
      throw new Error("'fund' is undefined");
    }

    if (!fromAccount) {
      throw new Error("'fromAccount' is undefined");
    }

    // FIXME: need to genetare a tx based on family (currency)
    const transaction: BitcoinTransaction | EthereumTransaction = {
      amount: new BigNumber(fund.amountExpectedFrom),
      recipient: fund.payinAddress,
      // FIXME: Hacky as hell
      family: fromAccount.currency as FAMILIES.BITCOIN | FAMILIES.ETHEREUM,
    };

    // Receive an operation object with the broadcasted transaction information including tx hash.
    api
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
  }, [api, fromAccount, fund, feesStrategy]);

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
