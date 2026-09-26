import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthShell } from '../AuthShell';

describe('AuthShell', () => {
  it('shows the 64px logo with a retina source above the title', () => {
    const { container } = render(<AuthShell title="Sign in">form</AuthShell>);
    const logo = container.querySelector('img');
    expect(logo).toHaveAttribute('src', '/images/logo/logo-64x64.png');
    expect(logo).toHaveAttribute('srcset', '/images/logo/logo-128x128.png 2x');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
