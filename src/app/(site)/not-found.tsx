import { NotFoundMessage } from "../not-found";

// notFound() from a storefront page (an unknown event id): (site)/layout.tsx already draws the navbar and footer
export default function NotFound() {
  return <NotFoundMessage />;
}
