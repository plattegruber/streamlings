defmodule LatticeWeb.HealthControllerTest do
  use LatticeWeb.ConnCase

  test "GET /health returns ok", %{conn: conn} do
    conn = get(conn, ~p"/health")
    assert json_response(conn, 200) == %{"status" => "ok"}
  end
end
