# RxPaired: RxPlayer's Able Inspector for REmote Debugging

This repository contains the RxPaired tool, a lightweight remote inspector adapted for
devices low on resources which displays supplementary indicators mostly useful when
using the [RxPlayer](https://github.com/canalplus/rx-player) library.

![screenshot of RxPaired](./screenshot.png)

This project is functional and is regularly used at Canal+ for debugging media
applications relying on the RxPlayer.

Its key features are:

 - Remote inspector with a minimal influence on the device's CPU and memory resources,
   when compared with Chrome's inspector and tools like weinre.

 - Ability to see in real time logs and useful playback indicators: the current size
   of the buffer built, which audio and video qualities are buffered etc.

 - Possibility to send JavaScript instructions to the device.

 - "Time travel": Possibility to see the known playback conditions and its related
   indicators at the time a log was sent, by clicking on it on the inspector.


## Table Of Contents

  - [What is it?](#what-is-it)
  - [How it works?](#how-it-works)
  - [How to run it?](#how-to-run-it)
  - [Why creating this tool?](#why-creating-this-tool)


<a class="anchor" href="#what-is-it"></a>
## What is it?

RxPaired was first and foremost created to improve debugging and manual testing
sessions on resource-constrained devices using the RxPlayer.

It aims to redirect logs received on the tested device to a web page (generally seen
on another device) while using the minimum resources possible on the tested device.

This web page also automatically exploits those logs to produce helpful graphs and
metrics about what's actually happening that might even not be visible on screen:
how much data is buffered, of what audio and video quality etc.

It also allows to emit instructions from the webpage to the device.

However, this tool was also written with modularity in mind. It should thus be very
easy to remove the RxPlayer "modules" from the web inspector of RxPaired, and replace
them by another logic, even for other usages than for media streaming.


<a class="anchor" href="#how-it-works"></a>
## How it works?

RxPaired comes in three parts:

  1. The inspector web application, found in the `./inspector` directory.

     This is the page that will be used to inspect what's going on on the device remotely
     from any browser.
     This page can also send instructions directly to the device (only through the page's
     console for now, as the user interface for this is not yet developped).

     Under the hood, this inspector relies on a [WebSocket](https://en.wikipedia.org/wiki/WebSocket)
     connection with RxPaired's server to receive the device's source information (logs,
     requests etc.) and it contains some logic to construct graphical "modules" based on
     those logs: charts, curated information about playback etc.

     Note that multiple inspector pages can be created at the same time for multiple
     devices and multiple inspector pages can also be linked if they want to the same
     device through a system of "tokens".

  2. A client-side script to deploy on the device, found in the `./client` directory.

     This script mostly [monkey-patches](https://en.wikipedia.org/wiki/Monkey_patch) console
     and request-related functions so any interaction with those is communicated with
     RxPaired's server through a WebSocket connection.

     This script is also able to execute commands sent from the Inspector web-application
     (which goes through the exact same WebSocket connection).

     The client-side script has a minimal amount of processing logic to communicate those
     information, so we can limit the influence on the device's performance. A single
     long-lived WebSocket connection is also used instead of multiple HTTP calls for those
     same considerations.

  3. The server, written in the `./server` directory, on which the two precedent parts
     rely.

     The server listens on two ports for WebSocket connections: one for the inspector and
     the other for the client-side script.

     The server is very configurable: it can for example set-up a set or random password
     (or none at all), shutdown when abnormal behavior is detected (like too many device
     or inspector connections, too many wrong password, too many WebSocket messages sent),
     create and keep log files for each inspected devices, give a maximum lifetime for
     each token, change the ports it listens to among other options.

     It can also keep an in-memory history of logs for any device currently sending logs,
     whose maximum size is configurable.
     Doing so allows other inspectors connecting later (e.g. other people looking at
     what's going on on their side) to still receive logs that were sent before they
     launched the inspector.

<a class="anchor" href="#how-to-run-it"></a>
## How to run it?

To run RxPaired you have to:
  1. start RxPaired-server in `./server` with the wanted options
  2. build and optionally serve the RxPaired-client script that will be put on the device
     (instructions and files in `./client`)
  3. build and serve the RxPaired-inspector web page (instructions and files in
     `./inspector`).
 
You can look at how to do just that by looking at the `README.md` file of each of those
subdirectories.

You can run the server and client on your own PC or on a server.
If you want to use HTTPS / WSS, which might be required on tested HTTPS applications,
you'll need to perform HTTPS tunnelling to that server. This can either be performed
through softwares like Apache or Nginx through configuration or by using a tunnelling
tool like [`ngrok`](https://ngrok.com/).


<a class="anchor" href="#why-creating-this-tool"></a>
## Why creating this tool?

The RxPlayer is an advanced media player which is used to play contents on a large panel
of devices. Like for most software, we sometimes need to start debugging sessions on one
of those, e.g., to investivate curious behavior.

As a player for the web platform, the RxPlayer can often profit from already available
remote web inspectors to do just that from our PC. Most notably, the featureful Chrome
remote debugger is a complete tool that is most often available.
In cases where it isn't, [weinre](https://people.apache.org/~pmuellr/weinre/docs/latest/Home.html)
is also a very useful tool.

However those tools have limitations on some devices.
The one that hindered us the most, is that those tools often use a lot of resources:
we're sometimes not even able to use the Chrome Remote Debugger for more than a minute on
some extreme targets (smart TVs, set-top boxes, ChromeCast...) and even in the time window
where we can, the resource usage those tools take might provoke large side-effects and is
a very frequent source of [heisenbug](https://en.wikipedia.org/wiki/Heisenbug) for our team.

When what we wanted to do was just to recuperate logs from the device, this became very
annoying.

After initial even-lighter tools like a simple HTTP, then
[WebSocket-based](https://gist.github.com/peaBerberian/5471f397b6dd3682bc5980d11cfc4421) 
log server, we noticed that we could do even better in terms of usability and usefulness
than a simple log server: our own remote inspector tool, whose core goal would be
lightweightness and, why not, also have the advantage of being specialized for the
debugging of the RxPlayer.

Enter RxPaired: The **RxP**layer's **A**ble **I**nspector for **Re**mote **D**ebugging
