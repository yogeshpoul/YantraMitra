// Fallback for paths outside any locale.
export default function RootNotFound() {
  return (
    <html lang="mr">
      <body style={{ fontFamily: 'system-ui', padding: '3rem', textAlign: 'center' }}>
        <h1>404</h1>
        <a href="/">यंत्रमित्र</a>
      </body>
    </html>
  );
}
