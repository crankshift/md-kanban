# Run the board as a local web app

The board will be launched by a CLI that starts a Node server on the user's machine and opens the web interface in their browser. This provides access to local ticket files and supports observing changes made by agents without depending on browser-specific folder-access APIs; users must keep the local process running while using the board. The CLI accepts an optional folder argument, defaulting to the directory from which it was launched.
