defmodule LatticeWeb.Router do
  use LatticeWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {LatticeWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", LatticeWeb do
    pipe_through :browser

    get "/", PageController, :home
  end

  scope "/", LatticeWeb do
    pipe_through :api

    get "/health", HealthController, :index
  end
end
