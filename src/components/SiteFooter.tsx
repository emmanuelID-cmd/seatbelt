export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <p style={{ margin: 0 }}>
        © {year} Seatbelt by Kinoshi. All rights reserved.
      </p>

      <p style={{ margin: '0.5rem 0 0' }}>
        <a href="/terms-of-service">Terms of Service</a>
        {' · '}
        <a href="/privacy-policy">Privacy Policy</a>
      </p>
    </footer>
  )
}
