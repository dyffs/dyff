The core problem is that teams have tacit knowledge that should shape AI reviews, but the capture mechanism can't require heavy upfront investment or reintroduce the noise problem the product is solving.

Most policies will be subtractive. Users won't know what policies to add until they see review output that's noisy or miscalibrated. The natural first action is "stop telling me about X" — suppression. Additive policies ("always check Y") will be rarer and tend to be genuinely important when they do exist.

Severity is the single control. Rather than exposing separate concepts like "risk override" vs "severity adjustment" vs "suppression," the authoring UI has one severity picker (critical, improvement, nit, suppress). The system internally routes the policy to the right place based on that choice — critical policies elevate files in the risk scope and create findings in AI review, lower severities only surface in AI review, and suppress hides matching findings entirely. The user never learns the routing logic.

The preview teaches the mapping. A live preview panel next to the form shows exactly where the policy will appear in the product UI, using realistic-looking content. When you change severity, the preview updates — the Summary tab toggle appears or disappears, the finding card moves between sections. This replaces documentation with direct demonstration.

The authoring form is four fields: name, instruction (plain language), file scope (glob pattern, optional), severity. That's it. Low enough friction that creating a policy after seeing a noisy finding takes under a minute.

Suppress can also be triggered in context — a "mute" action on an existing finding that auto-generates a suppression policy in the background, with zero authoring friction.