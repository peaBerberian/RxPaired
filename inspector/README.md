# RxPaired-inspector

This directory is the home of the `RxPaired-inspector`, the "inspector" part of the
RxPaired tool.

This is the code of the web interface allowing to inspect what's going on on the
inspected device.

## How to build and run it

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

In that new `.npmrc` file, you'll need to set two URLs:

  1. `inspector_debugger_url`:

     This will be the WebSocket address `RxPaired-server` is listening to for
     `RxPaired-inspector` connections.

     If you didn't start the `RxPaired-server` yet, you should first start doing this by
     going to the `../server` directory.

     Note that the URL already present uses the default port used by the server. If your
     server runs locally in the default config, you might not actually have to update it.

     In most cases however, you might want to use HTTPS/WSS instead of the default HTTP/WS
     (to make the `RxPaired-Client` runnable in HTTPS pages).
     There, you might need to update this value to the actual HTTPS URL used.

  2. `device_script_url`:

     This is the URL the `RxPaired-Client` (the script that will be deployed to devices)
     is available at.

     You can leave this URL empty if you do not wish to serve that script though HTTP(S)
     means.
     In that case, you will have to copy/paste the content of that script into the HTML
     page running on the device.

Once this is done, you can start building the `RxPaired-inspector`.

In your terminal, type:
```sh
npm run build:min
```

You can now start using the `RxPaired-inspector`, you just need to serve both the
`index.html` and the newly generated `inspector.js` files in the current directory.

You can do so easily by typing in a terminal:
```js
npm run serve
```

Multiple persons can even build and serve their own `RxPaired-inspector` while
debugging the same devices as long as the same `RxPaired-server` is used.

Though you might prefer the simplicity of just letting a "real" HTTP(S) server serve both
of those files instead. This way this build step does not need to be repeated for each
user.
