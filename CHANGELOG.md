# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

### Versioning

- update versions for development dependencies
- update `axios` to `^1.5.1`
- update `glob` to `^10.3.10`

## [0.6.0] - 2023-09-21

### Added

- command `update` added to push files to a remote CDN location without the npm semver PUT logic

### BREAKING CHANGE

- `publish` does not support anymore the [...files] argument. The behavior is moved to the `update` command
