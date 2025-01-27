# How to run agent manager

1. Duplicate the `.env.example` file, name it `.env` and fill in the values

2. Build the image

```bash
cd agentcoin-runtime
docker build -t agentcoin-runtime-image .
```

3. Run the manager

```bash
cd agentcoin-runtime
bun dev
```
