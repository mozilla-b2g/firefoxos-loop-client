all: tempRemoveBumpVersion .git/hooks/post-commit .git/hooks/post-checkout .git/hooks/post-merge .git/hooks/post-rewrite updateVersion

tempRemoveBumpVersion:
	@rm -f .git/hooks/pre-commit
	@rm -f .commit

.git/hooks/post-commit: tools/update_version.sh
	test -d .git && ln -f tools/update_version.sh .git/hooks/post-commit || true

.git/hooks/post-checkout: tools/update_version.sh
	test -d .git && ln -f tools/update_version.sh .git/hooks/post-checkout || true

.git/hooks/post-merge: tools/update_version.sh
	test -d .git && ln -f tools/update_version.sh .git/hooks/post-merge || true

.git/hooks/post-rewrite: tools/update_version.sh
	test -d .git && ln -f tools/update_version.sh .git/hooks/post-rewrite || true

updateVersion:
	@tools/update_version.sh

build: clean updateVersion
	@tools/build_package.sh
	@ls -l output/

clean:
	@rm -rf output
	@rm js/version.js

uploadBuild: build
	@git checkout gh-pages 
	@git add output/*
	@rm -rf js/
	@git commit -m "Updated with new package \o/"
	@git push origin gh-pages -f
	@git checkout master
