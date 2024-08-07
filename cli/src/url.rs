use http::{uri::InvalidUri, Uri};
use std::{borrow::Cow, fmt::Display, ops::Deref, str::FromStr};
pub use url::*;

#[derive(Debug, Clone, PartialEq)]
pub struct UrlPath(String);

impl UrlPath {
    pub fn join(&self, other: &Self) -> Self {
        if self.as_ref() == "/" || self.as_ref() == "" {
            other.clone()
        } else if other.as_ref() == "/" || other.as_ref() == "" {
            self.clone()
        } else {
            Self(format!("{}/{}", self, other))
        }
    }
}

impl UrlPath {
    pub fn file_name(&self) -> Option<&str> {
        self.0.split("/").filter(|&s| !s.is_empty()).last()
    }
}

impl Display for UrlPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for UrlPath {
    fn default() -> Self {
        Self(String::from("/"))
    }
}

impl Deref for UrlPath {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        self.as_ref()
    }
}

impl AsRef<str> for UrlPath {
    fn as_ref(&self) -> &str {
        self.0.as_str()
    }
}

impl FromStr for UrlPath {
    type Err = InvalidUri;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut cow = Cow::from(s);
        if !cow.starts_with('/') {
            *cow.to_mut() = format!("/{}", s);
        }

        let uri: Uri = cow.parse().inspect_err(|err| eprintln!("{cow} {err}"))?;
        let path = uri
            .path()
            .split('/')
            .filter(|&s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("/");

        Ok(Self(path))
    }
}

#[derive(Clone, PartialEq)]
pub struct UrlDirPath(String);

impl UrlDirPath {
    pub fn join(&self, path: &UrlPath) -> UrlPath {
        UrlPath(format!("{}{}", self, path))
    }
}

impl From<UrlDirPath> for UrlPath {
    fn from(UrlDirPath(value): UrlDirPath) -> Self {
        Self(value)
    }
}

impl AsRef<str> for UrlDirPath {
    fn as_ref(&self) -> &str {
        self.0.as_str()
    }
}

impl From<&UrlPath> for UrlDirPath {
    fn from(value: &UrlPath) -> Self {
        Self(format!("{}/", value))
    }
}

impl Display for UrlDirPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::UrlPath;
    use rstest::rstest;

    #[rstest]
    #[case("/path/////", Some("path"))]
    #[case("/path/?", Some("path"))]
    #[case("/path", Some("path"))]
    #[case("/", Some(""))]
    #[case("", None)]
    fn parse_string_test(#[case] input: &str, #[case] expected: Option<&str>) {
        let uri: Result<UrlPath, _> = input.parse().inspect_err(|err| {
            if expected.is_some() {
                eprintln!("{err}")
            }
        });
        assert_eq!(uri.ok().as_deref(), expected)
    }
}
