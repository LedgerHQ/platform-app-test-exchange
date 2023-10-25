import { ExchangeType } from "@ledgerhq/wallet-api-core";
import base64url from "base64url";
import sha256 from "js-sha256";
import secp256r1 from "secp256r1";
import numberToBigEndianBuffer from "../utils/numberToBigEndianBuffer";
import getPayinAddressForTicker from "./getPayinAddressForTicker";
import "./protocol_pb.js";

export const TEST_PRIVATE_KEY = Buffer.from([
  0x10, 0x67, 0xe5, 0xf6, 0xb3, 0x48, 0xea, 0xc2, 0x68, 0xb6, 0x4f, 0xc9, 0xeb,
  0x5a, 0x31, 0xa7, 0xd7, 0x9e, 0x33, 0xdf, 0xd6, 0xfe, 0xf7, 0x6e, 0xab, 0x9f,
  0x49, 0x9b, 0x47, 0xee, 0xd6, 0x9d,
]);

const generatePayloadAndSignature = (
  data: proto.ledger_swap.NewSellResponse | proto.ledger_swap.NewFundResponse
) => {
  const payload = Buffer.from(data.serializeBinary());

  const base64Payload = Buffer.from(base64url(payload));

  const message = Buffer.concat([Buffer.from("."), base64Payload]);
  const digest = Buffer.from(sha256.sha256.array(message));

  const signature = Buffer.from(
    secp256r1.sign(digest, TEST_PRIVATE_KEY).signature
  );

  return { binaryPayload: base64Payload, signature };
};

const getFundData = ({
  txId,
  amount,
  ticker,
  payinAddress,
}: {
  txId: string;
  amount: number;
  ticker: string;
  payinAddress: string;
}) => {
  const tr = new proto.ledger_swap.NewFundResponse();
  const transactionId = base64url.toBuffer(txId);

  tr.setDeviceTransactionId(transactionId);
  tr.setInAddress(payinAddress);
  tr.setInAmount(numberToBigEndianBuffer(amount));
  tr.setInCurrency(ticker);
  tr.setUserId("John Doe");
  tr.setAccountName("Card 1234");

  return tr;
};

const getSellData = ({
  txId,
  amount,
  ticker,
  payinAddress,
}: {
  txId: string;
  amount: number;
  ticker: string;
  payinAddress: string;
}) => {
  const tr = new proto.ledger_swap.NewSellResponse();
  const transactionId = base64url.toBuffer(txId);

  // The outAmount will be 10.25 (cf. https://github.com/LedgerHQ/app-exchange/blob/master/src/proto/protocol.proto#L18)
  const outAmount = new proto.ledger_swap.UDecimal([
    numberToBigEndianBuffer(1025),
    2,
  ]);

  tr.setDeviceTransactionId(transactionId);
  tr.setInAddress(payinAddress);
  tr.setInAmount(numberToBigEndianBuffer(amount));
  tr.setInCurrency(ticker);
  tr.setOutAmount(outAmount);
  tr.setOutCurrency("EUR");
  tr.setTraderEmail("test@test.com");

  return tr;
};

const getData = ({
  exchangeType,
  txId,
  amount,
  ticker,
}: {
  exchangeType: ExchangeType;
  txId: string;
  amount: number;
  ticker: string;
}) => {
  const payinAddress = getPayinAddressForTicker(ticker);

  const tr = (() => {
    switch (exchangeType) {
      case ExchangeType.FUND:
        return getFundData({ txId, amount, ticker, payinAddress });

      case ExchangeType.SELL:
        return getSellData({ txId, amount, ticker, payinAddress });

      default:
        throw new Error(
          `Test data for exchangeType '${exchangeType}' not supported yet`
        );
    }
  })();

  const { binaryPayload, signature } = generatePayloadAndSignature(tr);

  return {
    binaryPayload,
    signature,
    amountExpectedFrom: amount,
    payinAddress,
  };
};

export default getData;
