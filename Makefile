all: .git/hooks/pre-commit .git/hooks/post-commit

.git/hooks/pre-commit: tools/pre-commit
	test -d .git && cp tools/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit || true

.git/hooks/post-commit: tools/post-commit
	test -d .git && cp tools/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit || true
