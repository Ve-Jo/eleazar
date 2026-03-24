Activities Overview

Copy page

Learn about Discord Activities - multiplayer games and social experiences.

Building Discord Activities
Activities are web apps hosted in an iframe that use the Embedded App SDK to communicate with Discord clients. For an introduction to what Activities are, see the Activities platform page.
This section covers how Activities are built. You can explore real-world Activities by reading some of our developer case studies, or jump right into building using the resources below.
Build Your First Discord Activity
Follow the guide to build your first Activity using the Embedded App SDK.
Development Patterns
Explore common development patterns and practices to make building Activities simpler.
How Activities Work
Learn more about the lifecycle of Activities and how they run in Discord clients.
​
Developing Activities
Whether you’re developing a multiplayer game, a new social experience, or another creative idea, your Activity will be built as a web app that is run in an iframe in Discord on desktop, mobile, and web. You can get started by following the guide on Building an Activity using the Embedded App SDK or exploring the sample projects
The sections below provide an overview of the Embedded App SDK, but technical details about how Activities are run in Discord is covered in How Activities Work.
​
Embedded App SDK
The Embedded App SDK handles all of the communication between Discord and your app, making it easier to do common tasks like managing connected users, supporting mobile clients, and debugging your Activity.
The Embedded App SDK offers different events and commands to handle the communication between Discord and your Activity, which are covered more below.
​
Commands
The SDK has a set of commands you can call to interact with a Discord client, given you have the appropriate scopes. This is helpful when you want to do authorize and authenticate users, fetch information about your Activity, or update information for your Activity or an authenticated user.
Read the Embedded App SDK documentation for a full list of commands, and details about each command.
​
Events
The SDK also has events you can subscribe (or unsubscribe) to for things happening in a connected client that are relevant to your Activity, given you have the appropriate scopes. This is helpful when you want to do things like handle initial connection and thrown errors, listen to updates about a connected user, and listen to events related to your Activity instance.
Read the Embedded App SDK documentation for a full list of events, and details for each event.
​
Sample Projects
Use the sample projects we’ve built to help you get started building quickly and learn from common development patterns.
You can also find a list of community-maintained samples on GitHub, which includes more framework-specific examples.
Discord Activity Starter
This TypeScript starter template is perfect for getting your own Activity up and running quickly.
Embedded App SDK Playground
This reference example implements the commands and events available to you within the Embedded App SDK.
Nested Framework App
This reference example demonstrates an Activity using a nested framework like a game engine.

Discord Embedded App Starter
This repo is a minimal starter-project. Getting an embedded app running in Discord can be complex. The goal of this example is to get you up-and-running as quickly as possible, while making it easy to swap in pieces to fit your embedded app's client and server needs.

Client architecture
The client (aka front-end) is using ViteJS's Vanilla Typescript starter project. Vite has great starter projects in many common javascript frameworks. All of these projects use the same config setup, which means that if you prefer React, Svelte, etc... you can swap frameworks and still get the following:

Fast typescript bundling with hot-module-reloading
Identical configuration API
Identical environment variable API
Note: ViteJS is not required to use Discord's embedded-app-sdk. ViteJS is a meta-client-framework we are using to make it easy to help you get running quickly, but the core concepts of developing an embedded application are the same, regardless of how you are consuming embedded-app-sdk.

Server architecture
The server (aka back-end) is using Express with typescript. Any file in the server project can be imported by the client, in case you need to share business logic.

Setting up your Discord Application
Before we write any code, lets follow the instructions here to make sure your Discord application is set up correctly.

Setting up your environment variables
In this directory (/examples/discord-activity-starter) we need to create a .env file with the OAuth2 variables, as described here.

VITE_CLIENT_ID=123456789012345678
CLIENT_SECRET=abcdefghijklmnopqrstuvwxyzabcdef
Adding a new environment variable
In order to add new environment variables, you will need to do the following:

Add the environment key and value to .env
Add the key to /examples/discord-activity-starter/packages/client/src/vite-env.d.ts
Add the key to /examples/discord-activity-starter/packages/server/environment.d.ts
This will ensure that you have type safety when consuming your environment variables

Running your app locally
As described here, we encourage using a tunnel solution such as cloudflared for local development. To run your app locally, run the following from this directory (/examples/discord-activity-starter)

pnpm install # only need to run this the first time
pnpm dev
pnpm tunnel # from another terminal
Be sure to complete all the steps listed here to ensure your development setup is working as expected.

SDK Playground
Tech Stack
This repo is an example built on top of the following frameworks

ReactJS - A frontend javascript UI framework
Cloudflare Workers - A serverless execution environment
Client architecture
The client (aka front-end) is using ViteJS's React Typescript starter project. Vite has great starter projects in many common javascript frameworks. All of these projects use the same config setup, which means that if you prefer VanillaJS, Svelte, etc... you can swap frameworks and still get the following:

Fast typescript bundling with hot-module-reloading
Identical configuration API
Identical environment variable API
Server architecture
The server (aka back-end) is using Cloudflare workers with typescript. Any file in the server project can be imported by the client, in case you need to share business logic.

Setting up your Discord Application
Before we write any code, lets follow the instructions here to make sure your Discord application is set up correctly.

oauth2-details

Running your app locally
As described here, we encourage using a tunnel solution such as cloudflared for local development. To run your app locally, run the following from this directory (/examples/sdk-playground)

pnpm install # only need to run this the first time
pnpm dev
pnpm tunnel # from another terminal
Be sure to complete all the steps listed here to ensure your development setup is working as expected.

Adding a new environment variable
In order to add new environment variables, you will need to do the following:

Add the environment key and value to .env
Add the key to /packages/client/src/vite-env.d.ts
Add the key to /packages/server/src/types.ts
This will ensure that you have type safety in your client and server code when consuming environment variables

Per the ViteJS docs

To prevent accidentally leaking env variables to the client, only variables prefixed with VITE_ are exposed to your Vite-processed code.

# Example .env file
VITE_CLIENT_ID=123456789012345678
CLIENT_SECRET=abcdefghijklmnopqrstuvwxyzabcdef # This should be the application oauth2 token from the developer portal.
BOT_TOKEN=bot_token
See instructions on getting the oauth2 token and the bot token here.

Manual Deployment
Steps to manually deploy the embedded app 0. Have access to the Discord Dev cloudflare account

Log into cloudflare with your credentials associated with Discord Dev
wrangler login
Create or verify .env.production file If you haven't made it yet, copy the example.env file, rename it to .env.production, and add the VITE_CLIENT_ID and CLIENT_SECRET variables

Build and deploy the client

cd packages/client
npm run build
CLOUDFLARE_ACCOUNT_ID=867c81bb01731ca0dfff534a58ce67d7 npx wrangler pages publish dist
Build and deploy the server
cd packages/server
npm run deploy
Testing SDK changes locally
In order to test changes to the embedded-app-sdk locally, follow these steps:

In a separate directory, clone the embedded-app-sdk github repo
From that directory, run npm run dev to continuously rebuild the SDK when changes are made
From inside of the sdk-playground's client directory, link the sdk via pnpm
cd embedded-app-sdk-examples/sdk-playground-packages/client
pnpm link ~/path/to/embedded-app-sdk # this is an example path
cd embedded-app-sdk-examples/sdk-playground
pnpm dev
You should now be up and running with your own local build of the embedded-app-sdk. Be sure to not commit the linked pnpm-lock.yaml file.

Note - You may need to close and relaunch the activity for changes to the sdk to take effect

Embedded app with Nested Messages
The embedded-app-sdk is intended for use by a single-page application. We recognize developers may be using frameworks or approaches that do not necessarily "fit into the bucket" of single-page applications, and wanted to provide some suggestions, specifically, we recommend nesting those frameworks inside of your embedded app's top-level single-page application and passing messages as you see fit. The developer recognizes that Discord may not be able to provide support, guidance, or code samples for communication required between your embedded app's top-level single-page applications and any frameworks you use inside of it.

This example shows how an embedded app with a nested framework, such as a iframe hosting a multi-page-app, an iframe hosting a Unity App, or any other unique framework can be set up to work inside of a Discord embedded app iframe. We will create a parent website to mount the nested framework, hold state, and pass along messages between the Discord Client and the nested framework. This example is not meant to serve as a source-of-truth for how you should implement passing messages, instead it's a minimal example, which you could take inspiration from, or expand upon, based on your embedded app's needs.

How to run
This embedded app depends on the embedded-app-sdk being built. To build the package, from the root of this repository run the following commands in your terminal.

pnpm install
pnpm build
Set up your .env file
Copy/rename the .example.env file to .env. Fill in CLIENT_ID and CLIENT_SECRET with the OAuth2 Client ID and Client Secret, as described here.

To serve this embedded app locally, from terminal navigate to /embedded-app-sdk/examples/nested-messages and run the following:

pnpm install
pnpm dev
Many ways to solve a puzzle
In this example, the core issue we're trying to solve is how to pass messages (commands, responses, and event subscriptions) between the Discord client and a nested framework inside of your embedded app. This example solves the puzzle by creating a MessageInterface class which looks very similar to embedded-app-sdk. This is for the following reasons:

It's also using javascript inside the nested iframe
It needs to solve many similar problems, such as passing events and listening for events that have been subscribed to.
Depending on your use-case, you may find an alternate solution to MessageInterface to be a better fit for your embedded app.

Nested Messages architecture
Routing
All client code is located in /client and is served via a NodeJS Express server. Each route is provided by an index.html file. Each index.html file has a corresponding index.ts file and a (gitignored) compiled index.js file which is consumed by the html file. For example, let's consider the nested "embedded app", which is served at /nested. When a user visits this route, they are sent the file client/nested/index.html which imports the compiled javascript from client/nested/index.ts.

Build tooling
All typescript files inside of the client directory can be compiled into javascript files by running npm run build. When developing, you can run npm run dev which will rebuild whenever a file-change is detected inside of the client directory.

Routes
In this example, we have an embedded app which is nested inside of the parent "embedded app host". The embedded app host's responsibility is to initialize the SDK, listen for commands sent from the nested embedded app, and pass along responses sent by the Discord client.

We have added a button to the nested embedded app which allows it to call window.location.reload() without invalidating the embedded app session.

Nested message management
See client/index.ts to learn more about the "how" of how this example supports nested embedded app messages.

How Activities Work

Copy page

Understand the technical architecture and lifecycle of Discord Activities.

Activities are web applications that run in an iframe within Discord on desktop, mobile and web. In order to achieve this, we use the postMessage protocol to enable secure communication between your application and Discord.
The Embedded App SDK simplifies this process by managing the postMessage protocol on your behalf. For details on available commands and their usage, consult the SDK Reference. Our Sample Projects provide practical examples of how to implement these features.
​
Launching Activities
After you have Activities enabled in your Application’s Activity’s settings, your app can launch Activities in two ways:
When a user invokes your app’s Entry Point command in the App Launcher
By responding to an interaction with the LAUNCH_ACTIVITY callback type
Each of these are covered in more detail in the below sections.
​
Entry Point Command
Activities are primarily opened when users invoke your app’s Entry Point command in the App Launcher.
When you enable Activities for your app, a default Entry Point command called “Launch” is created for you. By default, Discord automatically handles opening your Activity when your Entry Point command is run by a user.
Read more about setting up Entry Point commands in the development guide.
​
Interaction Response
Activities can be launched in response to command, message component, and modal submission interactions. To open an Activity, set the callback type to LAUNCH_ACTIVITY (type 12) when responding to the interaction.
​
Designed for Single-Page Apps (SPAs)
This SDK is intended for use by a single-page application. We recognize developers may be using frameworks or approaches that are not an exact fit for single-page applications. We recommend nesting those frameworks inside your Activity’s top-level single-page application and passing messages as you see fit. Please refer to the Nested Messages App sample project for guidance on this approach.
​
Activity Lifecycle
Initialization: When your iframe is loaded within Discord, it will include unique query parameters in its URL. These parameters are identifiable by your application using the Discord SDK.
Handshake Process: Constructing the SDK instance begins a handshake process with the Discord client. Once the connection is established, the iframe receives a [FRAME, {evt: 'READY', ...}] message. The ready() method of the SDK instance resolves once a successful connection has been established.
Authorization and Authentication: After receiving the READY payload, your application should perform authorization and authentication to acquire necessary permissions (scopes). This step is crucial for utilizing specific features or scopes, such as rpc.activities.write.
Interacting with Discord Client: Post-authentication, your application can subscribe to events and send commands to the Discord client. Note that attempting to use commands or subscribe to events outside your granted scope will result in errors. Adding new scopes may prompt an OAuth modal for user permission re-confirmation.
Disconnection and Errors: Receiving a [CLOSE, {message: string, code: number}] message indicates an error or a need to restart the connection process.
Sending Errors or Close Requests: To communicate an error or request a close from the Discord client, send [CLOSE, {message?: string, code: number}]. A code other than CLOSE_NORMAL will display the message to the user, while CLOSE_NORMAL results in a silent closure.
​
Sample Code and Activity Lifecycle Diagram
Below is a minimal example of setting up the SDK. Please see our Sample Projects for more complete sample applications.
import {DiscordSDK} from '@discord/embedded-app-sdk';
const discordSdk = new DiscordSDK(YOUR_OAUTH2_CLIENT_ID);

async function setup() {
  // Wait for READY payload from the discord client
  await discordSdk.ready();

  // Pop open the OAuth permission modal and request for access to scopes listed in scope array below
  const {code} = await discordSdk.commands.authorize({
    client_id: YOUR_OAUTH2_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });

  // Retrieve an access_token from your application's server
  const response = await fetch('/.proxy/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
    }),
  });
  const {access_token} = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });
}
This diagram illustrates the communication flow between your application and Discord in the sample code above.
Diagram of how Activities communicate with Discord

Building Your First Activity in Discord

Copy page

Step-by-step tutorial for creating your first Discord Activity.

Activities are web-based games and apps that can be run within Discord. Activities are embedded in iframes within the Discord client, and can be launched from the App Launcher or when responding to interactions.
If this is your first time learning about Activities, check out the Activities Overview for more information and a collection of more advanced sample projects.
​
Introduction
In this guide, we’ll be building a Discord app with a basic Activity that handles user authentication and fetches data using the API.
It assumes an understanding of JavaScript and async functions, and a basic understanding of frontend frameworks like React and Vue. If you are still learning to program, there are many free education resources to explore like The Odin Project, Codecademy, and Khan Academy.
What we'll be building

Building Your First Activity Tutorial
Resources used in this guide

discord/getting-started-activity, a project template to get you started
@discord/embedded-app-sdk, the SDK used to communicate between your app and Discord when building Activities
Node.js, latest version
Express, a popular JavaScript web framework we’ll use to create a server to handle authentication and serve our app
Vite, a build tool for modern JavaScript projects that will make your application easier to serve
cloudflared, for bridging your local development server to the internet
​
Step 0: Enable Developer Mode
Before getting started, you need to enable Developer Mode for your Discord account if you don’t already have it enabled. Developer Mode will allow you to run in-development Activities and expose resource IDs (like users, channels, and servers) in the client which can simplify testing. To enable Developer Mode:
Go to your User Settings in your Discord client. On Desktop, you can access User Settings by clicking on the cogwheel icon near the bottom-left, next to your username.
Click on Advanced tab from the left-hand sidebar and toggle on Developer Mode.
​
Step 1: Setting up the project
Before creating an app, let’s set up our project code from the discord/getting-started-activity repository.
Open a terminal window and clone the project code:
git clone git@github.com:discord/getting-started-activity.git
The sample project you cloned is broken into two parts:
client is the sample Activity’s frontend, built with vanilla JavaScript and integrated with Vite to help with local development.
server is a backend using vanilla JavaScript, Node.js, and Express. However, as you’re building your own Activity, you can use whichever backend you prefer.
Project structure

Overview of the project structure for the sample app used in this guide

​
Install project dependencies
Before creating our Discord app, let’s quickly install your project’s frontend dependencies.
Navigate to your project folder’s client directory, which is where all the sample Activity’s frontend code lives:
cd getting-started-activity/client
Then install the project’s dependencies and start up the frontend for the sample Activity:
# install project dependencies
npm install

# start frontend
npm run dev
If you visit http://localhost:5173/ you should see a vanilla JS frontend template running with Vite.
While it’s not much at the moment, in the following steps we’ll connect it to the backend services, make it runnable in Discord, and power it up by populating it with data we pull from Discord APIs.
Step 1 Checkpoint

By the end of Step 1, you should have:
An understanding of what Discord Activities are
Developer Mode enabled on your Discord account
Cloned the sample project to your development environment
Installed the front-end dependencies (in the client folder)
​
Step 2: Creating an app
With our project set up, let’s create our app and configure the Activity. Create a new app in the developer portal if you don’t have one already:
Create App
Enter a name for your app, select a development team, then press Create.
Development Team Access
Launching a non-distributed Activity is limited to you or members of the developer team, so if you’re collaborating with others during development, create a developer team and set it to the owner when you create the app.
After you create your app, you’ll land on the General Information page of the app’s settings, where you can update basic information about your app like its description and icon.
​
Choose installation contexts
Apps in Discord can be installed to different installation contexts: servers, user accounts, or both.
The recommended and default behavior for apps is supporting both installation contexts, which lets the installer to choose the context during the installation flow. However, you can change the default behavior by changing the supported installation contexts in your app’s settings.
Why do installation contexts matter?

Overview of where apps can be installed

Click on Installation in the left sidebar, then under Installation Contexts make sure both “User Install” and “Guild Install” are selected. This will make sure users can launch our app’s Activity across Discord servers, DMs, and Group DMs.
​
Add a Redirect URI
Next, we’ll add a Redirect URI, which is where a user is typically redirected to after authorizing with your app when going through the standard OAuth flow. While setting up a Redirect URI is required, the Embedded App SDK automatically handles redirecting users back to your Activity when the RPC authorize command is called.
You can learn more about the OAuth flow and redirect URIs in the OAuth2 documentation, but since we’re only authorizing in an Activity, we’ll just use a placeholder value (https://127.0.0.1) and let the Embedded App SDK handle the rest.
Click on OAuth2 in your app’s settings. Under Redirects, enter https://127.0.0.1 as a placeholder value then click Save Changes.
Redirect URI in Activity Settings
​
Fetch Your OAuth2 Credentials
To use information related to a user (like their username) or a server (like the server’s avatar), your app must be granted specific OAuth scopes.
For our sample app, we’ll be requesting three scopes: identify to access basic information about a user, guilds to access basic information about the servers a user is in, and applications.commands to install commands. We’ll request these later on in the guide, but a full list of scopes you can request is in the OAuth2 documentation.
When requesting scopes later on, you’ll need to pass your app’s OAuth2 identifiers. For now, we’ll copy these identifiers into your project’s environment file.
In the root of your project, there is an example.env file. From the root of your project, run the following to copy it into a new .env file:
cp example.env .env
Secure Your Secrets
Your DISCORD_CLIENT_SECRET and DISCORD_BOT_TOKEN are highly sensitive secrets. Never share either secrets or check them into any kind of version control.
Back in your app’s settings, click on OAuth2:
Client ID: Copy the value for Client ID and add it to your .env file as VITE_CLIENT_ID. This is the public ID that Discord associates with your app, and is almost always the same as your App ID.
Client Secret: Copy the value for Client Secret and add it to your .env as DISCORD_CLIENT_SECRET. This is a private, sensitive identifier that your app will use to grant an OAuth2 access_token, and should never be shared or checked into version control.
Why is there a VITE_ prefix before our Client ID?
Prefixing the CLIENT_ID environment variable with VITE_ makes it accessible to our client-side code. This security measure ensures that only the variables you intend to be accessible in the browser are available, and all other environment variables remain private. You can read details in the Vite documentation.
Step 2 Checkpoint

By the end of Step 2, make sure you have:
Set up a placeholder Redirect URI
Added your app’s Client ID and Client Secret to your project’s .env file.
​
Step 3: Setting Up the Embedded App SDK
With our project and app set up, we’re going to install and configure the Embedded App SDK which we’ll use extensively through the rest of this guide.
The Embedded App SDK is a first-party SDK that handles the communication between Discord and your Activity with commands to interact with the Discord client (like fetching information about the channel) and events to listen for user actions and changes in state (like when a user starts or stops speaking).
The events and commands available in the Embedded App SDK are a subset of the RPC API ones, so referencing the RPC documentation can be helpful to understand what’s happening under the hood when developing Activities.
​
Install the SDK
Back in our project’s client directory from before (getting-started-activity/client), install the Embedded App SDK via NPM:
npm install @discord/embedded-app-sdk
This will add @discord/embedded-app-sdk to getting-started-activity/client/package.json and install the SDK in your node_modules folder.
​
Import the SDK in your Project
Once installed, we need to import it into our client code and instantiate it to start the handshake between our app and the Discord client.
To instantiate the SDK, we will use the environment variables we set up in Step 2.
We also set up a check for the ready event with an async/await function which allows us to output a log or perform other actions once the handshake was successful.
Add SDK initialization to frontend

Code for adding the Embedded App SDK

Time to leave your browser behind
Once you add the SDK to your app, you will not be able to view your app inside your web browser. In the next step, we will run your Activity inside of Discord. In the next step, we will go over how to view your app in Discord.
Step 3 Checkpoint

By the end of Step 3, make sure you have:
Installed the Embedded App SDK to your project
Imported the SDK in your project’s client/main.js file
​
Step 4: Running your app in Discord
Let’s ensure everything is wired up correctly, enable activities via the dev portal, and then run the Activity in Discord.
​
Run your app
First, we’ll restart the sample app. Open a terminal window and navigate to your project directory’s client folder, then start the client-side app:
cd client
npm run dev
Your app should start and you should see output similar to the following:
VITE v5.0.12  ready in 100 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
We’ll use the Local URL as our publicly-accessible URL in the next step.
​
Set up a public endpoint
Next, we’ll need to set up the public endpoint that serves the Activity’s frontend. To do that, we’ll create a tunnel with a reverse proxy. While we’ll be using cloudflared in this guide, you can use ngrok or another reverse proxy solution if you prefer.
While your app is still running, open another terminal window and start a network tunnel that listens to the port from the last step (in this case, port 5173):
cloudflared tunnel --url http://localhost:5173
When you run cloudflared, the tunnel will generate a public URL and you’ll see output similar to the following:
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://funky-jogging-bunny.trycloudflare.com
Copy the URL from the output, as we’ll need to add it to our app’s settings.
​
Set up your Activity URL Mapping
Because Activities are in a sandbox environment and go through the Discord proxy, you’ll need to add a public URL mapping to serve your application and make external requests in your Activity. Since we’re developing locally, we’ll use the public endpoint we just set up.
Back in your app’s settings, click on the URL Mappings page under Activities on the left-hand sidebar. Enter the URL you generated from cloudflared in the previous step.
Configuring your URL Mapping
PREFIX	TARGET
/	funky-jogging-bunny.trycloudflare.com
Read details about URL Mapping in the development guide.
​
Enable Activities
Next, we’ll need to enable Activities for your app. On the left hand sidebar under Activities, click Settings.
Find the first checkbox, labeled Enable Activities. Turn it on 🎉
Enabling Activities in Settings
​
Default Entry Point Command
When you enable Activities for your app, a default Entry Point command called “Launch” is automatically created. This Entry Point command is the primary way for users to launch your Activity in Discord.
By default, interactions with this command will result in Discord opening your Activity for the user and posting a message in the channel where it was launched from. However, if you prefer to handle the interactions in your app, you can update the handler field or create your own. Additional details are in the Entry Point command documentation and development guide.
​
Running your Activity in Discord
Now that we are pointing Discord to our locally running app, we can launch the Activity in Discord!
Navigate to your Discord test server and, in any voice and or text channel, open the App Launcher where your in-development Activity should be present. If you don’t see your Activity, you should try searching for its name.
Clicking on your app will launch your locally running app from inside Discord!
Running your activity
Customizing your Activity
If you’d like to set images for your Activity, you can learn how to do that here.
We’re looking pretty good so far, but we haven’t wired up any Discord functionality yet. Let’s do that next.
Step 4 Checkpoint

By the end of Step 4, make sure you have:
Set up a public endpoint
Added an Activity URL Mapping in your app’s settings
Enabled Activities for your app
Successfully launched your Activity in Discord
​
Step 5: Authorizing & authenticating users
To authenticate your Activity with the users playing it, we must finish implementing our server-side app and get it talking to the client-side app.
We will use express for this example, but any backend language or framework will work here.
OAuth2 Flow Diagram

# move into our server directory
cd server

# install dependencies
npm install
We aren’t going to edit the server code here, but it consists of a single POST route for /api/token that allows us to perform the OAuth2 flow from the server securely.
getting-started-activity/server/server.js

Now, start the project’s backend server:
npm run dev
You should output similar to the following:
> server@1.0.0 dev
> node server.js

Server listening at http://localhost:3001
We can now run our server and client-side apps in separate terminal windows. You can see other ways to set this up in the other sample projects.
​
Calling external resources from your activity
Before we call your backend activity server, we need to be aware of the Discord proxy and understand how to avoid any Content Security Policy (CSP) issues.
Learn more about this topic in the guides for Constructing a Full URL and Using External Resources.
​
Calling your backend server from your client
We’re almost there! Now, we need our client application to communicate with our server so we can start the OAuth process and get an access token.
What is vite.config.js?
To allow our frontend app to call our Express server, Vite requires us to set up a proxy for /api/* to our backend server, which is running on port 3001. In their docs, you can learn more about Vite.
Calling the backend server

Code for authorizing and authenticating

Copy the following code in your project’s getting-started-activity/client/main.js file:
import { DiscordSDK } from "@discord/embedded-app-sdk";

import rocketLogo from '/rocket.png';
import "./style.css";

// Will eventually store the authenticated user's access_token
let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  // We can now make API calls within the scopes we requested in setupDiscordSDK()
  // Note: the access_token returned is a sensitive secret and should be treated as such
});

async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands"
    ],
  });

  // Retrieve an access_token from your activity's server
  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

document.querySelector('#app').innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h1>Hello, World!</h1>
  </div>
`;
Now if we relaunch our app, we’ll be prompted to authorize with Discord using the identify, guilds, and applications.commands scopes.
Prompt to authorize Activity
Safe storage of tokens
Access tokens and refresh tokens are powerful, and should be treated similarly to passwords or other highly-sensitive data. Store both types of tokens securely and in an encrypted manner.
Step 5 Checkpoint

By the end of Step 5, make sure you have:
Updated your client/main.js to call the backend to support user authorization and authentication
Been able to successfully complete the authorization flow for your app when opening your Activity
​
Step 6: Use the SDK to fetch the channel
Now that we have authenticated our users, we can start interacting with contextual Discord information that we can use in our application.
Let’s use the SDK to get details about the channel that our activity is running in. We can do this by writing a new async function that uses the commands.getChannel SDK method.
Fetching a channel using the SDK

In the same getting-started-activity/client/main.js file, paste the following function:
async function appendVoiceChannelName() {
  const app = document.querySelector('#app');

  let activityChannelName = 'Unknown';

  // Requesting the channel in GDMs (when the guild ID is null) requires
  // the dm_channels.read scope which requires Discord approval.
  if (discordSdk.channelId != null && discordSdk.guildId != null) {
    // Over RPC collect info about the channel
    const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
    if (channel.name != null) {
      activityChannelName = channel.name;
    }
  }

  // Update the UI with the name of the current voice channel
  const textTagString = `Activity Channel: "${activityChannelName}"`;
  const textTag = document.createElement('p');
  textTag.textContent = textTagString;
  app.appendChild(textTag);
}
Now, update the callback after setupDiscordSdk() to call the function you just added:
setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  appendVoiceChannelName();
});
If you close and rejoin the Activity, you should now see the name of the current channel.
Discord Activities
Step 6 Checkpoint

By the end of Step 6, make sure you have:
Updated your client/main.js code to fetch the channel name using the SDK
Added a call to the new function in the callback for setupDiscordSdk()
​
Step 7: Use the API to fetch the guild
Since we requested the identify and guilds scopes, you can also use the authorized access_token we received earlier to fetch those resources via the API.
In the following code block, we will:
Call the GET /users/@me/guilds endpoint with auth.access_token to get a list of the guilds the authorizing user is in
Iterate over each guild to find the guild we are in based on the guildId defined in discordSdk
Create a new HTML image element with the guild avatar and append it to our frontend
In this example, we use a pure fetch request to make the API call, but you can us one of the JavaScript community-built libraries if you prefer.
Fetching information about the current server

In the same client/main.js file, add the following function:
async function appendGuildAvatar() {
  const app = document.querySelector('#app');

  // 1. From the HTTP API fetch a list of all of the user's guilds
  const guilds = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
    headers: {
      // NOTE: we're using the access_token provided by the "authenticate" command
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  // 2. Find the current guild's info, including it's "icon"
  const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);

  // 3. Append to the UI an img tag with the related information
  if (currentGuild != null) {
    const guildImg = document.createElement('img');
    guildImg.setAttribute(
      'src',
      // More info on image formatting here: https://docs.discord.com/developers/reference#image-formatting
      `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`
    );
    guildImg.setAttribute('width', '128px');
    guildImg.setAttribute('height', '128px');
    guildImg.setAttribute('style', 'border-radius: 50%;');
    app.appendChild(guildImg);
  }
}
Then, call the new function in the callback for setupDiscordSdk:
setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  appendVoiceChannelName();
  appendGuildAvatar();
});
If we relaunch our Activity, we will see the current server’s avatar render in our Activity.
Discord Activities
Step 7 Checkpoint

At this point, you should have your Activity up and running. For Step 7, you should have:
Updated your client/main.js code to fetch the guild information using the GET /users/@me/guilds API endpoint
Added a call to the new function in the callback for setupDiscordSdk()