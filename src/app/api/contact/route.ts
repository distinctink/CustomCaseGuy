import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { name, email, message } = await request.json()

    // Basic validation
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      )
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      )
    }

    // Send via email service if configured, otherwise log
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL

    if (webhookUrl) {
      // Send to Make.com / Zapier / custom webhook
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          timestamp: new Date().toISOString(),
          source: 'customcaseguy.com',
        }),
      })

      if (!res.ok) {
        console.error('Webhook failed:', res.status, await res.text())
        return NextResponse.json(
          { error: 'Failed to send message. Please try again or email us directly.' },
          { status: 500 }
        )
      }
    } else {
      // Log to console in development
      console.log('Contact form submission (no webhook configured):', {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please email us at info@customcaseguy.com.' },
      { status: 500 }
    )
  }
}
