import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>404</h1>
      <p>This page does not exist. / រកមិនឃើញទំព័រនេះទេ។</p>
      <Link className="btn btn-primary" href="/">
        Dashboard
      </Link>
    </main>
  );
}
