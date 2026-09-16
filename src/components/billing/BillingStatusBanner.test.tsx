import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Subscription } from '@/domain'
import { renderWithProviders } from '@/test/render'
import { BillingStatusBanner, BillingStatusBannerView } from './BillingStatusBanner'

const base: Subscription = { planId: 'plan-family', status: 'Active', currentPeriodEnd: '2026-09-28T00:00:00Z' }

function renderView(subscription: Subscription) {
  return render(
    <MemoryRouter>
      <BillingStatusBannerView subscription={subscription} />
    </MemoryRouter>,
  )
}

describe('BillingStatusBannerView', () => {
  it('renders nothing for an active or trialing subscription', () => {
    const { container, rerender } = renderView(base)
    expect(container).toBeEmptyDOMElement()
    rerender(
      <MemoryRouter>
        <BillingStatusBannerView subscription={{ ...base, status: 'Trialing' }} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('warns about a past-due payment with a link to billing', () => {
    renderView({ ...base, status: 'PastDue' })
    expect(screen.getByRole('alert')).toHaveTextContent('Payment past due')
    expect(screen.getByRole('link', { name: 'Update payment' })).toHaveAttribute('href', '/billing')
  })

  it('shows a canceled state with a call to choose a plan', () => {
    renderView({ ...base, status: 'Canceled' })
    expect(screen.getByRole('alert')).toHaveTextContent('Subscription canceled')
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/billing')
  })
})

describe('BillingStatusBanner (connected via mock service + MSW)', () => {
  it('reflects the seeded past-due subscription', async () => {
    renderWithProviders(<BillingStatusBanner orgId="org-lindqvist" />)
    expect(await screen.findByTestId('billing-banner')).toHaveTextContent('Payment past due')
  })
})
