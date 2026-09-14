export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        width: '100%',
        padding: '1.5rem 1rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        lineHeight: '1.4rem',
        color: 'inherit',
        borderTop: '1px solid currentColor',
        opacity: 0.8,
      }}
    >
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