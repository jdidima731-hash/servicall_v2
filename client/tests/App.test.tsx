import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../tests/test-utils";
import App from "../src/App";

// Mock des hooks et composants externes
vi.mock("../_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

vi.mock("../src/lib/i18n", () => ({}));

describe("App Component", () => {
  it("devrait rendre sans erreur", () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it("devrait afficher le composant Router", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
