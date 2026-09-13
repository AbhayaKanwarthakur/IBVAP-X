export default async function run(page) {
  const views = [
    ['Command Center', 'COMMAND CENTER'],
    ['Video Analysis', 'VIDEO ANALYSIS'],
    ['Zone Editor', 'FOV ZONE EDITOR'],
  ]
  const results = []
  for (const [button, heading] of views) {
    await page.getByRole('button', { name: button }).click()
    await page.getByText(heading, { exact: true }).waitFor({ timeout: 10000 })
    results.push({ button, heading, rendered: true })
  }
  return results
}
