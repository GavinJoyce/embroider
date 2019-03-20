const execa = require('execa');

test('static-app', async () => {
  jest.setTimeout(60000);

  await execa('yarn', ['test'], {
    cwd: `${__dirname}/static-app`,
  });
});
