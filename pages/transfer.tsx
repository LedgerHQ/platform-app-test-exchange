import { useWalletAPIClient } from "@ledgerhq/wallet-api-client-react";
import {
  Account,
  BitcoinTransaction,
  Currency,
  EthereumTransaction,
  ExchangeComplete,
  ExchangeType,
} from "@ledgerhq/wallet-api-core";
import { BigNumber } from "bignumber.js";
import { useCallback, useEffect, useState } from "react";
import getData from "../src/getData";
import parseCurrencyUnit from "../src/utils/parseCurrencyUnit";
import styles from "../styles/Home.module.css";

/**
 * FIXME: for now only these currencies are handled for test purposes.
 * Would need to generate test config for other assets to expend the list
 */
const AVAILABLE_CURRENCIES = [
  "bitcoin",
  "ethereum",
  "ethereum/erc20/usd_tether__erc20_",
];

type FeeStrategies = ExchangeComplete["params"]["feeStrategy"];

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
  const { client } = useWalletAPIClient();

  const exchangeTypeKey = ExchangeType[exchangeType];

  const [currencies, setCurrencies] = useState<Currency[]>();
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAccount, setFromAccount] = useState<Account>();
  const [feeStrategy, setFeeStrategy] = useState<FeeStrategies>("SLOW");
  const [data, setData] = useState<Data>();
  const [transactionHash, setTransactionHash] = useState<string>();

  const [request, setRequest] = useState<Request>(initialRequest);

  useEffect(() => {
    client?.currency
      .list()
      .then((sdkCurrencies) => setCurrencies(sdkCurrencies));
  }, [client?.currency]);

  const requestFrom = useCallback(() => {
    client?.account
      .request({
        currencyIds: AVAILABLE_CURRENCIES,
      })
      .then((account) => {
        setFromAccount(account);
      });
  }, [client?.account]);

  const requestNonce = useCallback(() => {
    client?.exchange
      .start(exchangeType === ExchangeType.FUND ? "FUND" : "SELL")
      .then(setNonce);
  }, [client?.exchange, exchangeType]);

  // request fund or sell from partner using data in request, to get "binaryPayload" and "signature"
  const requestData = useCallback(() => {
    const currency = currencies?.find(
      (cur) => cur.id === fromAccount?.currency
    );

    if (!currency) {
      throw new Error("currency not found");
    }

    const amountToFund = parseCurrencyUnit(
      currency.decimals,
      request.amountFrom
    );

    const newData = getData({
      exchangeType: exchangeType,
      txId: request.deviceTransactionId,
      amount: amountToFund.toNumber(),
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

    const currency = currencies?.find(
      (cur) => cur.id === fromAccount?.currency
    );

    if (!currency) {
      throw new Error("currency not found");
    }

    /**
     * FIXME: Hacky as hell
     * we now handle token currencies, type in SDK should be updated accordingly
     */
    // @ts-ignore
    const family = currency.parent || currency.family;

    // FIXME: need to genetare a tx based on family (currency)
    const transaction: BitcoinTransaction | EthereumTransaction = {
      amount: new BigNumber(data.amountExpectedFrom),
      recipient: data.payinAddress,
      family,
    };

    // Receive an operation object with the broadcasted transaction information including tx hash.
    if (exchangeType === ExchangeType.FUND) {
      client?.exchange
        .completeFund({
          provider,
          fromAccountId: fromAccount.id,
          transaction,
          binaryPayload: data.binaryPayload,
          signature: data.signature,
          feeStrategy,
        })
        .then(setTransactionHash);
    } else {
      client?.exchange
        .completeSell({
          provider,
          fromAccountId: fromAccount.id,
          transaction,
          binaryPayload: data.binaryPayload,
          signature: data.signature,
          feeStrategy,
        })
        .then(setTransactionHash);
    }
  }, [
    data,
    fromAccount,
    currencies,
    exchangeType,
    client?.exchange,
    feeStrategy,
  ]);

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

        <button disabled={!nonce} onClick={requestData}>
          {`Request ${exchangeTypeKey}`}
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
                  /**
                   * Note: display "binaryPayload" and "signature" buffers as
                   * hex string for readability
                   */
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
