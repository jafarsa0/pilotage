# Security

Pilotage is a specification, not a running service, but specification
defects can create vulnerabilities in every implementation. Reports of that
class are treated as security issues.

## What to report here

- A flaw in the normative text that would lead a conformant implementation
  into a vulnerability (for example: a gap in the risk-gate rules, the
  authorization-indistinguishability requirements, the promoted-program
  authority model, or the error-channel routing).
- An example or schema in this repository that, if copied, produces
  insecure behavior.

Vulnerabilities in specific Pilotage *implementations* belong with those
implementations' maintainers.

## How to report

Open a GitHub security advisory on this repository (preferred), or a
regular issue if the report does not require confidentiality. Reports
receive an acknowledgment and a public resolution: a spec erratum,
clarification, or versioned change per VERSIONING.md.

## Design posture (for reviewers)

The specification's own threat stance is normative in Part II: Sections 9
(trust model: server-published data are unverified claims; teaching
surfaces are prompt-injection surfaces and must be treated as data) and 10
(security requirements: bounded evaluation including validation,
programs-as-data, authorization scoping with indistinguishability,
promoted-program authority). Security review of the spec should start
there.
