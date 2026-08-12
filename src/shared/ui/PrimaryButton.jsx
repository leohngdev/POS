export function PrimaryButton({ children, ...props }) {
  return (
    <button className="primary-button" type="button" {...props}>
      {children}
    </button>
  );
}
