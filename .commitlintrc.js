/** @type {import('cz-git').UserConfig} */
export default {
  prompt: {
    types: [
      { value: 'feat', name: 'feat: new feature' },
      { value: 'fix', name: 'fix: bug fix' },
      { value: 'docs', name: 'docs: documentation only' },
      { value: 'style', name: 'style: formatting only' },
      { value: 'refactor', name: 'refactor: code change without behavior change' },
      { value: 'perf', name: 'perf: performance improvement' },
      { value: 'test', name: 'test: test changes' },
      { value: 'build', name: 'build: build or dependency changes' },
      { value: 'ci', name: 'ci: continuous integration changes' },
      { value: 'chore', name: 'chore: maintenance' },
      { value: 'revert', name: 'revert: revert a previous commit' },
    ],
    scopes: [],
    allowCustomScopes: true,
    allowEmptyScopes: true,
    upperCaseSubject: false,
    markBreakingChangeMode: true,
    allowBreakingChanges: ['feat', 'fix'],
    breaklineNumber: 100,
    breaklineChar: '|',
    confirmColorize: true,
  },
}
