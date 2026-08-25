'use client';

import { useActionState, useEffect } from 'react';

import { submitBetaInterestAction } from '../app/actions';
import { emitMarketingEvent } from '../lib/analytics';
import { initialMarketingFormState } from '../lib/marketing-form-state';
import { FieldError } from './field-error';

export function BetaForm({ compact = false }: { readonly compact?: boolean }) {
  const [state, formAction, pending] = useActionState(
    submitBetaInterestAction,
    initialMarketingFormState,
  );

  useEffect(() => {
    if (state.status === 'SUCCESS' || state.status === 'DUPLICATE') {
      emitMarketingEvent({
        name: 'beta_form_submitted',
        properties: { outcome: state.status.toLowerCase() },
      });
    }
  }, [state.status]);

  if (state.status === 'SUCCESS' || state.status === 'DUPLICATE') {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <span className="form-success-mark" aria-hidden="true">
          ✓
        </span>
        <h3>{state.status === 'SUCCESS' ? "You're in." : 'Already registered.'}</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={compact ? 'lead-form lead-form-compact' : 'lead-form'}
      noValidate
    >
      <fieldset disabled={pending}>
        <legend className="sr-only">Join the Thriftage beta</legend>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor={compact ? 'footer-website' : 'beta-website'}>Website</label>
          <input
            autoComplete="off"
            id={compact ? 'footer-website' : 'beta-website'}
            name="website"
            tabIndex={-1}
            type="text"
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={compact ? 'footer-email' : 'beta-email'}>Email</label>
            <input
              aria-describedby="beta-email-error"
              aria-invalid={state.fieldErrors.email !== undefined}
              autoComplete="email"
              id={compact ? 'footer-email' : 'beta-email'}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <FieldError errors={state.fieldErrors.email} id="beta-email-error" />
          </div>
          <div className="field">
            <label htmlFor={compact ? 'footer-city' : 'beta-city'}>City</label>
            <input
              aria-describedby="beta-city-error"
              aria-invalid={state.fieldErrors.city !== undefined}
              autoComplete="address-level2"
              id={compact ? 'footer-city' : 'beta-city'}
              name="city"
              placeholder="e.g. Lahore"
              required
            />
            <FieldError errors={state.fieldErrors.city} id="beta-city-error" />
          </div>
          <div className="field">
            <label htmlFor={compact ? 'footer-audience' : 'beta-audience'}>I’m joining as</label>
            <select
              aria-describedby="beta-audience-error"
              aria-invalid={state.fieldErrors.audience !== undefined}
              defaultValue=""
              id={compact ? 'footer-audience' : 'beta-audience'}
              name="audience"
              required
            >
              <option disabled value="">
                Choose one
              </option>
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
              <option value="BOTH">Both</option>
            </select>
            <FieldError errors={state.fieldErrors.audience} id="beta-audience-error" />
          </div>
          {!compact && (
            <div className="field">
              <label htmlFor="beta-style">
                Style interest <span>Optional</span>
              </label>
              <input
                aria-describedby="beta-style-error"
                id="beta-style"
                name="styleInterest"
                placeholder="Vintage, modest, streetwear…"
              />
              <FieldError errors={state.fieldErrors.styleInterest} id="beta-style-error" />
            </div>
          )}
        </div>
        <button className="button button-coral" disabled={pending} type="submit">
          {pending ? 'Joining…' : 'Get early access'} <span aria-hidden="true">→</span>
        </button>
        <p className="form-privacy">
          We’ll only use your details for beta access and relevant product updates.
        </p>
        {state.message !== '' && (
          <p className="form-message" role="alert" aria-live="polite">
            {state.message}
          </p>
        )}
      </fieldset>
    </form>
  );
}
