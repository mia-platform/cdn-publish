# magic-box

## CLI proposal

- publish
  - `-k, --access-key` API access key
  - `-p, --project` location of package.json
  - varargs to be globbed (if none let's look for package.json otherwise throw)

## Note

```shell
echo "secret-data" | mystery-box -k "$(</dev/stdin)"
```
