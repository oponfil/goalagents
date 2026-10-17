-- Payments moved from Creem to Polar: the customer and subscription ids are the payment
-- provider's, whichever it is.
alter table public.accounts rename column creem_customer_id to customer_id;
alter table public.accounts rename column creem_subscription_id to subscription_id;
