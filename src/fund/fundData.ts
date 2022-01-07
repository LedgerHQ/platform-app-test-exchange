import "../utils/protocol_pb.js";
import secp256r1 from "secp256r1";
import sha256 from "js-sha256";
import base64url from "base64url";

const fundTestPrivateKey = Buffer.from([
  0x10, 0x67, 0xe5, 0xf6, 0xb3, 0x48, 0xea, 0xc2, 0x68, 0xb6, 0x4f, 0xc9, 0xeb,
  0x5a, 0x31, 0xa7, 0xd7, 0x9e, 0x33, 0xdf, 0xd6, 0xfe, 0xf7, 0x6e, 0xab, 0x9f,
  0x49, 0x9b, 0x47, 0xee, 0xd6, 0x9d,
]);

function numberToBigEndianBuffer(x: number) {
  var hex = x.toString(16);
  return Uint8Array.from(
    Buffer.from(hex.padStart(hex.length + (hex.length % 2), "0"), "hex")
  );
}

const getPayinAddressForTicker = (ticker: string): string | null => {
  switch (ticker) {
    case "BTC":
      return "bc1qh9qljpv0ltjceyeaz8mydp5zgaswgswhwt3jgl";

    case "ETH":
      return "0xb761505466b080a9a7227e303BF93D6CbFd8d801";

    default:
      return null;
  }
};

const getFundData = ({
  txId,
  ammount,
  ticker,
}: {
  txId: string;
  ammount: number;
  ticker: string;
}) => {
  const tr = new proto.ledger_swap.NewFundResponse();

  const transactionId = base64url.toBuffer(txId);

  const payinAddress = getPayinAddressForTicker(ticker);

  if (!payinAddress) {
    throw new Error("No payinAddress for fund data");
  }

  tr.setUserId("John Doe");
  tr.setAccountName("Card 1234");
  tr.setInAddress(payinAddress);
  tr.setInCurrency(ticker);
  tr.setInAmount(numberToBigEndianBuffer(ammount));
  tr.setDeviceTransactionId(transactionId);

  console.log({ tr });

  const payload = Buffer.from(tr.serializeBinary());

  const base64_payload = Buffer.from(base64url(payload));

  const message = Buffer.concat([Buffer.from("."), base64_payload]);
  const digest = Buffer.from(sha256.sha256.array(message));

  const signature = Buffer.from(
    secp256r1.signatureExport(
      secp256r1.sign(digest, fundTestPrivateKey).signature
    )
  );

  return {
    binaryPayload: base64_payload.toString("hex"),
    signature: signature.toString("hex"),
    amountExpectedFrom: ammount,
    payinAddress,
  };
};

export default getFundData;
