# RxPaired-server

This directory is the home of the `RxPaired-server`, the "server" part of the
RxPaired tool.

Its role is to listen and emit on two WebSocket ports:

  - one for communication with the tested device

  - the other for communication to the web inspector, the webpage allowing to
    inspect what's going on on the device.


## Note about the default server behavior

The server was initially written mostly for short-scale usage, to be exposed to the
internet on a relatively small server and to require as few maintenance as possible.

As such, it will by default generate a password and will shutdown automatically when any
"abnormal" but impactful behavior is detected (all of this is configurable):
  1. when more than 50 passwords have been received the last 24h
  2. when more than 500 client connections happen in the last 24h
  3. when more than 500 device connections happen in the last 24h
  4. When more than a million WebSocket messages coming from all devices is received in
     a group of 24h (also, client messages that are too long are ignored)
  5. When more than 1000 message coming from all clients is received in a group of 24h.

The server can in any case be restarted and those limitations be disabled at any time.

This was mostly done as a prevention measure from our own mistakes (we could for
example have accidently written an infinite loop blasting logs!) but also as a signal
for when curious traffic is coming from elsewhere.


## How to run it

Before being able to start the server, you first need to install the few node
dependencies it needs:
```sh
npm install --only=prod # install only non-dev dependencies
```

The server can then be run simply by calling the `./RxPaired-server` executable:
```sh
./RxPaired-server
```
_(Note: this should automatically use node.js to run this script. If the previous
command does not work, you can manually run it though the node.js executable instead.)_

It is recommended that you look at the server options first to see if there's things you
want to tweak. You can look at all available options by calling:
```sh
./RxPaired-server --help
```


## About HTTPS/WSS

The RxPaired-server uses WebSocket connections relying on HTTP, and not HTTPS.

This may be problematic when testing applications on devices running as an HTTPS page,
as browsers will generally block such "unsecure" requests when coming from a "secure" web
page.

To work-around this issue, it is for now recommended to set up an HTTPS proxy, which
will redirect to the right RxPaired port(s).
This can be done by using server softwares like [Apache](https://httpd.apache.org/)
or [Nginx](https://www.nginx.com/) on servers with a valid certificate, __OR__, if you
don't have such server at hand, solutions like [ngrok](https://ngrok.com/).

Note that technically, if you prefer to only proxify one WebSocket connection between
the two listened to, the one listening for devices is usually the most important one.
This is because the other one will be linked to the `RxPaired-inspector`, which you're
hosting yourself. As such, you may just decide to run it from an HTTP URL which itself
has no issue relyng on another HTTP server.
And even when launching the RxPaired-inspector through HTTPS, it should generally be easy
enough to disable the corresponding "mixed contents" security checks on your personal
browsers.


## How to update it and build it

The RxPaired-server code is written in TypeScript and can be found in the `src`
directory, the main file (the first file being called) being `src/main.ts`.

Before building it, you should install all dependencies:
```sh
npm install
```

And you can then call the `build` script to update the code in `./build` (on which
`./RxPaired-server` points to):
```sh
npm run build
```

You can look at the other available npm scripts by peeking inside `package.json`.
