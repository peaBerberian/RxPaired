# RxPaired-client

This directory is the home of the `RxPaired-client`, the script of RxPaired
that will run on the device.

This script mostly re-implement the console logging functions (`console.log`,
`console.warn` etc.) to send logs through a WebSocket to the `RxPaired-server`
(see `../server` directory), does the same thing to network-related APIs, and
optionally evaluate code sent from the `RxPaired-inspector` and send back the
result.


## How to build it and what to do with it

To build it, you first need to install its dependencies.

To do that, make sure that you have `npm` installed and this repository cloned.
Then go to this directory on a terminal, and type:
```sh
npm install
```

You then have to create a `.npmrc` file in this directory.
You can base yourself on the `.npmrc.sample` file:
```sh
cp .npmrc.sample .npmrc
```
### The `device_debugger_url`

In that new `.npmrc` file, you'll need to set one URL: the `device_debugger_url`.

This will be the WebSocket address `RxPaired-server` is listening to for
`RxPaired-client` connections and messages.

If you didn't start the `RxPaired-Server` yet, you should first start doing this by
going to the `../server` directory.

Note that the URL already present uses the default port used by the server. If your
server runs locally in the default config, you might not actually have to update it.

In most cases however, you might want to use HTTPS/WSS instead of the default HTTP/WS
(to make the `RxPaired-Client` runnable in HTTPS pages).
There, you might need to update this value to the actual HTTPS URL used.

### Building the script

Once this is done, you can start building the `RxPaired-client`.

In your terminal, type:
```sh
npm run build:min
```

The script should now be built at `./client.js`. Note that it relies on ES6, if
your devices are only ES5-compatible you can rely on `./client.es5.js` instead.

### Optionally serving the script

At last, you have two choices in how to deploy that script:

  - Either you store it on an HTTP(S) server, in which case you'll have to
    indicate its URI to the `RxPaired-inspector` (more information on that
    in its directory: `../inspector`).

    This is the recommended choice.
    If you choose to go this way, the `RxPaired-inspector` will conveniently
    provide you updated URLs (it adds a number-sign token to it) as well as
    an handy HTML `<script>` element to include on your application's HTML
    page(s) (the one running on the device).

  - Or if you don't want to involve an HTTP(S) server in here, you may just need
    to manually deploy the whole script yourself on your applications manually.

In both cases, `RxPaired-inspector` will give you all the necessary instructions.
