# platform-app-test-exchange

A Live App allowing to test and debug interactions between the [live-app-sdk](https://github.com/LedgerHQ/live-app-sdk) exchange related features and the nano [app-exchange](https://github.com/LedgerHQ/app-exchange).

For more information about creating a Live App and integrate it in Ledger Live, head on to our [Developer portal](https://developers.ledger.com/docs/platform-app/introduction/).

## How it works

The Live App generates and signs locally a protobuf payload, [expected by the nano app](https://github.com/LedgerHQ/app-exchange/blob/master/src/proto/protocol.proto), using a test partner config signed by a Ledger test key. For it to work with the nano exchange app, you will need to download a specific test version of the nano exchange app, using one of these techniques:

- by selecting the provider n°7 in ledger live desktop under `Settings > Experimental features > Manager provider`
- by [building and loading the nano app manually](https://developers.ledger.com/docs/nano-app/build/), with the `TEST_PUBLIC_KEY` flag if you want to use the provided `TEST_PRIVATE_KEY`

<details>
  <summary>Video demo 🎥</summary>

https://user-images.githubusercontent.com/9203826/149354415-84fb387c-4a68-4bea-af04-cd74b422f0ea.mp4

</details>

## Getting started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

For test purposes, you can optionaly start the Ledger Live application with the following flags:

- `DISABLE_TRANSACTION_BROADCAST`: to prevent transactions for being broadcasted to the network, usefull if you just want to test payload generation and signature

- `MOCK_EXCHANGE_TEST_CONFIG`: to enable the use of the provided `TEST_PRIVATE_KEY`, used to sign payloads locally and use the test version of the app exchange. This is usefull if you don't have a partner configuration setup with Ledger yet.

Here is an example using these two flags with a Ledger Live build on macOS:

```bash
DISABLE_TRANSACTION_BROADCAST=1 MOCK_EXCHANGE_TEST_CONFIG=1 /Volumes/Macintosh\ HD/Applications/Ledger\ Live.app/Contents/MacOS/Ledger\ Live
```

Copy the following manifest in a `manifest.json` file.

```json
{
  "id": "test-app",
  "name": "Test",
  "url": "http://localhost:3000",
  "homepageUrl": "",
  "icon": "",
  "platform": "all",
  "apiVersion": "0.0.1",
  "manifestVersion": "1",
  "branch": "debug",
  "categories": ["tools"],
  "currencies": "*",
  "content": {
    "shortDescription": {
      "en": "Test"
    },
    "description": {
      "en": "Test"
    }
  },
  "permissions": [
    {
      "method": "*"
    }
  ],
  "domains": ["https://*"]
}
```

Add this local manifest in Ledger Live to use this local test live-app in Ledger Live context.
For further information, check out the [Developer Mode documentation](https://developers.ledger.com/docs/live-app/developer-mode/).

## Further configuration

A `testPayinAddress.json` file is located at the root of the directory and is used to reference destination (third service provider) addresses, by cryptocurrency, used for the different flows.

When using this repository locally for your tests, don't hesitate to override any of the default addresses with one that you control.

**⚠️ WARNING ⚠️: DO NOT SEND MONEY TO ANY OF THE DEFAULT ADDRESSES PROVIDED IN THIS REPOSITORY. Your money will be lost forever**
