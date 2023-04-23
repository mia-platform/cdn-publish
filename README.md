# magic-box

## CLI proposal

### publish

-> with `package.json`

```shell
mb publish -k <access_key>
```

where scope is given by the `name` in `package.json` and files to load are taken from `files`

-> without `package.json`

```shell
mb publish -k <access_key> --scope my-organization/my-library -- dist
```

- publish
  - `-k, --access-key` API access key
  - `-p, --project` location of package.json
  - varargs to be globbed (if none let's look for package.json otherwise throw)

## Note

```shell
echo "secret-data" | mystery-box -k "$(</dev/stdin)"
```
