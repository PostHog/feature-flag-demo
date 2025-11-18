Advanced configuration
These are features for advanced users and may lead to unintended side effects if not reviewed carefully.

Attribute	Description
advanced_disable_flags

Type: Boolean
Default: false	Will completely disable the /flags endpoint request (and features that rely on it). More details below.
advanced_disable_decide

Type: Boolean
Default: false	Legacy, prefer advanced_disable_flags. This configuration option behaves like advanced_disable_flags but will be deprecated in the future.
advanced_disable_feature_flags

Type: Boolean
Default: false	Will keep /flags running, but without any feature flag requests. Important: do not use this argument if using surveys, as display conditions rely on feature flags internally.
advanced_disable_feature_flags_on_first_load

Type: Boolean
Default: false	Stops from firing feature flag requests on first page load. Only requests feature flags when user identity or properties are updated, or you manually request for flags to be loaded.
advanced_only_evaluate_survey_feature_flags

Type: Boolean
Default: false	Determines whether PostHog should only evaluate feature flags for surveys. Useful for when you want to use this library to evaluate feature flags for surveys only but you have additional feature flags that you evaluate on the server side.
feature_flag_request_timeout_ms

Type: Integer
Default: 3000	Sets timeout for fetching feature flags
secure_cookie

Type: Boolean
Default: false	If this is true, PostHog cookies will be marked as secure, meaning they will only be transmitted over HTTPS.
custom_campaign_params

Type: Array
Default: []	List of query params to be automatically captured (see UTM Segmentation )
fetch_options.cache

Type: string
Default: undefined	fetch call cache behavior (see MDN Docs to understand available options). It's important when using NextJS, see companion documentation. This is a tricky option, avoid using it unless you are aware of the changes this could cause - such as cached feature flag values, etc.
fetch_options.next_options

Type: Object
Default: undefined	Arguments to be passed to the next key when calling fetch under NextJS. See companion documentation.
on_request_error

Type: Function
Default: logger.error('Bad HTTP status: ' + res.statusCode + ' ' + res.text)	Called whenever a PostHog request fails with an HTTP status code of 400 or higher. The callback function receives a RequestResponse object with the statusCode, text, and json (if available).

Disable /flags endpoint
Note: This feature was introduced in posthog-js 1.10.0. Previously, disabling autocapture would inherently disable the /flags endpoint altogether. This meant that disabling autocapture would inadvertently turn off session recording, feature flags, compression, and the toolbar too.

One of the first things the PostHog does after initializing is make a request to the /flags endpoint on PostHog's backend. This endpoint contains information on how to run the PostHog library so events are properly received in the backend and is required to run most features of the library (detailed below).

If you're not using any of these features, you may wish to turn off the call completely to avoid an extra request and reduce resource usage on both the client and the server.

The /flags endpoint can be disabled by setting advanced_disable_flags to true.


Resources dependent on /flags
Warning: These are features/resources that are fully disabled when the /flags endpoint is disabled.

Autocapture. The /flags endpoint contains information on whether autocapture should be enabled or not (apart from local configuration).
Session recording. The endpoint contains information on where to send relevant session recording events.
Compression. The endpoint contains information on what compression methods are supported on the backend (e.g. LZ64, gzip) for event payloads.
Feature flags. The endpoint contains the feature flags enabled for the current person.
Surveys. The endpoint contains information on whether surveys should be enabled or not.
Toolbar. The endpoint contains authentication information and other toolbar capabilities information required to run it.
Any custom event captures (posthog.capture), $identify, $set, $set_once and basically any other calls not detailed above will work as expected when /flags is disabled.