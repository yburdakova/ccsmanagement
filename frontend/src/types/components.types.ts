export type CustomInputProps = {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
};
