const numberToBigEndianBuffer = (x: number) => {
  var hex = x.toString(16);
  return Uint8Array.from(
    Buffer.from(hex.padStart(hex.length + (hex.length % 2), "0"), "hex")
  );
};

export default numberToBigEndianBuffer;
