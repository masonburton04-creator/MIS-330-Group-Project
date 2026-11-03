using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// ===== Login sessions =====
// When a user logs in, the API gives the browser a signed, HttpOnly cookie
// that holds their userId and role. The browser sends it back automatically
// with every request, and [Authorize] checks it on the server.
// This is built into ASP.NET Core, so no extra package is needed.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "CrimsonSupply.Auth";
        options.Cookie.HttpOnly = true;                    // JavaScript can't read it, which protects it from XSS
        options.Cookie.SameSite = SameSiteMode.Strict;     // never sent by other websites (blocks CSRF)
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;

        // By default a cookie login redirects to a login page. This is an API,
        // so answer with a status code instead and let the front end decide what to show.
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;   // not logged in
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;      // logged in, but not an Admin
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ===== Serve the website =====
// The front end lives in ../Client. Serving it from the API means the site and
// the API share one address (http://localhost:5095), so the login cookie just works
// and no separate front-end server is needed.
string clientFolder = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "Client"));
var clientFiles = new PhysicalFileProvider(clientFolder);
app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = clientFiles });   // "/" -> index.html
app.UseStaticFiles(new StaticFileOptions { FileProvider = clientFiles });

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
