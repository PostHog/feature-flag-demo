This is a demo project to demonstrate the various feature flag evaluation methods PostHog offers. The three main methods provided by the SDKs are:
1. client side evaluation (call PostHog's /flags endpoint from frontend SDK)
2. server side evaluation (call PostHog's /flags endpoint from backend SDK). Intended either for flag use/evaluation on the backend, or for passing flags to the frontend.
3. server side local evaluation (call PostHog's /feature-flags endpoint from backend SDK). Intended to be run as a service that polls a different endpoint than the first two, which pulls down all flag definitions and evaluates them locally provided the necessary person/group properties, essentially operating your own flags api. 

This application is meant to be a mock environment that shows the "frontend" on the lefthand side and the "backend" on the righthand side. There are components that show the relevant server logs (righthand side) and browser console logs (lefthand side) so that the user can see what information is being passed back and forth in each scenario and how flags are being evaluated in each of the three different scenarios. This is intended to be used in sales demos to show a technical audience how flags work, and have template code they can inspect for themselves. 

The tricky thing about getting this app working correctly is that typically any project running flags chooses only one (or two, in the case of both client/server flags) method, but rarely does it make sense to pair eg calling for individual user flags on the client with server side local eval. And it almost never makes sense to both call for individual flags on the backend *and* use local evaluation. 

Here are some outstanding items: 

- Probably most importantly, we need to sort out how we are going to switch on the server between local eval (in which the sdk needs to run as a long-running service so it can poll for latest flag definitions, eg every 30 seconds) and standard evaluation, when it is common to start up the sdk within the request lifecycle, pass it relevant data to get flags/capture events, and then shut it down. (please let me know if you understand the intended behavior differently). The sdk is meant to be a singleton, so we will need to have different running modes that are determined by a selector in the frontend which needs to be passed back via API (likely along with the rest of the frontend form input data on the lefthand "browser" side). **Getting this frontend-backend interaction right and ensuring it can control flag evaluation method on the server, and getting the respective log components to display what is actually happening is the crux of the entire app.**
- There is already a skeleton of an app that shows some server logs. Browser console logs need to be added in a component on the left side. In both cases, the logs need to be highly specific and should not show everything logged, so we need to create a special class for what should be displayed on each, and pass relevant logs to that in code. In the console, we would only want to see the output of:
    - identifying users in posthog
    - switching flag evaluation methods (server, client, server local eval)
    - calling for flags from frontend
    - receiving a flag payload from the backend
    - triggering the code path that depends on a feature flag
- In the server logs, we would want to see the following:
    - switching flag evaluation methods (only between regular server side and local eval)
    - feature flag call for a single user 
    - local evaluation call to pull down all flags
    - calling for flag for a single user when using local evaluation (using the only_evaluate_locally: false option it will attempt to go to remote server if necessary properties are not passed in to complete the evaluation) — this is an edge case we don't need to handle immediately. 

I have saved this prompt in .claude/project_prompts/startup_prompt_11-14-25 for future reference. Please create a running to-do list there with these items to keep track of status.
