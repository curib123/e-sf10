# e-sf10

A React-based application for managing ESF10 forms.

## Prerequisites

Ensure you have the following installed:

- Node.js (v14 or higher)
- npm

## Installation Steps

1. **Clone the repository:**

```bash
git clone https://github.com/curib123/e-sf10.git
Navigate into the project directory:

bash
Copy code
cd e-sf10
Install project dependencies:

bash
Copy code
npm install
Set up environment variables:

Create a .env file in the root directory and add:


REACT_APP_API_BASE_URL=http://localhost:3001/esf10
REACT_APP_API_LOGO_URL=http://localhost:3001

npm start
The app will run at http://localhost:3000

Additional Notes
Ensure your backend server is running at http://localhost:3001 to handle API requests.

The .env file is required for API endpoints and environment settings.

