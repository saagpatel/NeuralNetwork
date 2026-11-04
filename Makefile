.PHONY: check

check:
	@command -v pnpm >/dev/null 2>&1 || { echo "run: corepack enable"; exit 1; }
	pnpm run typecheck
	pnpm run format:check
	pnpm lint
	pnpm test
	pnpm build
