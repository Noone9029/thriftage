'use client';

import { useActionState, useEffect } from 'react';

import { submitSellerInterestAction } from '../app/actions';
import { emitMarketingEvent } from '../lib/analytics';
import { initialMarketingFormState } from '../lib/marketing-form-state';
import { FieldError } from './field-error';

export function SellerForm() {
  const [state, formAction, pending] = useActionState(
    submitSellerInterestAction,
    initialMarketingFormState,
  );

  useEffect(() => {
    if (state.status === 'SUCCESS' || state.status === 'DUPLICATE') {
      emitMarketingEvent({
        name: 'seller_form_submitted',
        properties: { outcome: state.status.toLowerCase() },
      });
    }
  }, [state.status]);

  if (state.status === 'SUCCESS' || state.status === 'DUPLICATE') {
    return (
      <div className="form-success form-success-light" role="status" aria-live="polite">
        <span className="form-success-mark" aria-hidden="true">
          ✓
        </span>
        <h2>{state.status === 'SUCCESS' ? 'Application received.' : 'Already on file.'}</h2>
        <p>
          {state.status === 'SUCCESS'
            ? 'Thanks for introducing your closet. We’ll reach out when seller beta places open.'
            : 'We already have a seller application for this email. There is nothing else to do.'}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="seller-form" noValidate>
      <fieldset disabled={pending}>
        <legend>Tell us about your closet</legend>
        <p className="form-intro">
          No business registration or sensitive documents—just enough to plan the early seller
          group.
        </p>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="seller-website">Website</label>
          <input autoComplete="off" id="seller-website" name="website" tabIndex={-1} type="text" />
        </div>
        <div className="seller-form-grid">
          <div className="field">
            <label htmlFor="seller-name">Name</label>
            <input
              aria-describedby="seller-name-error"
              aria-invalid={state.fieldErrors.name !== undefined}
              autoComplete="name"
              id="seller-name"
              name="name"
              required
            />
            <FieldError errors={state.fieldErrors.name} id="seller-name-error" />
          </div>
          <div className="field">
            <label htmlFor="seller-email">Email</label>
            <input
              aria-describedby="seller-email-error"
              aria-invalid={state.fieldErrors.email !== undefined}
              autoComplete="email"
              id="seller-email"
              name="email"
              required
              type="email"
            />
            <FieldError errors={state.fieldErrors.email} id="seller-email-error" />
          </div>
          <div className="field">
            <label htmlFor="seller-city">City</label>
            <input
              aria-describedby="seller-city-error"
              aria-invalid={state.fieldErrors.city !== undefined}
              autoComplete="address-level2"
              id="seller-city"
              name="city"
              required
            />
            <FieldError errors={state.fieldErrors.city} id="seller-city-error" />
          </div>
          <div className="field">
            <label htmlFor="seller-type">Seller type</label>
            <select
              aria-describedby="seller-type-error"
              aria-invalid={state.fieldErrors.sellerType !== undefined}
              defaultValue=""
              id="seller-type"
              name="sellerType"
              required
            >
              <option disabled value="">
                Choose one
              </option>
              <option value="CLOSET_SELLER">Personal closet</option>
              <option value="THRIFT_RESELLER">Thrift reseller</option>
              <option value="FASHION_CREATOR">Fashion creator</option>
              <option value="OTHER">Other</option>
            </select>
            <FieldError errors={state.fieldErrors.sellerType} id="seller-type-error" />
          </div>
          <div className="field">
            <label htmlFor="seller-volume">Approximate items</label>
            <select
              aria-describedby="seller-volume-error"
              aria-invalid={state.fieldErrors.itemVolume !== undefined}
              defaultValue=""
              id="seller-volume"
              name="itemVolume"
              required
            >
              <option disabled value="">
                Choose a range
              </option>
              <option value="ONE_TO_TEN">1–10</option>
              <option value="ELEVEN_TO_THIRTY">11–30</option>
              <option value="THIRTY_ONE_TO_SEVENTY_FIVE">31–75</option>
              <option value="MORE_THAN_SEVENTY_FIVE">More than 75</option>
            </select>
            <FieldError errors={state.fieldErrors.itemVolume} id="seller-volume-error" />
          </div>
          <div className="field">
            <label htmlFor="seller-store">
              Instagram or store link <span>Optional</span>
            </label>
            <input
              aria-describedby="seller-store-error"
              aria-invalid={state.fieldErrors.storeUrl !== undefined}
              id="seller-store"
              name="storeUrl"
              placeholder="https://…"
              type="url"
            />
            <FieldError errors={state.fieldErrors.storeUrl} id="seller-store-error" />
          </div>
          <div className="field field-full">
            <label htmlFor="seller-message">
              What do you sell? <span>Optional</span>
            </label>
            <textarea
              aria-describedby="seller-message-error"
              aria-invalid={state.fieldErrors.message !== undefined}
              id="seller-message"
              name="message"
              placeholder="Tell us about your pieces, style, or current shop."
              rows={4}
            />
            <FieldError errors={state.fieldErrors.message} id="seller-message-error" />
          </div>
        </div>
        <button className="button button-coral" disabled={pending} type="submit">
          {pending ? 'Sending…' : 'Apply as a seller'} <span aria-hidden="true">→</span>
        </button>
        <p className="form-privacy">
          Your information stays private and is used only for Thriftage seller recruitment.
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
