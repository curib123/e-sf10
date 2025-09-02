# e-sf10

A React-based application for managing ESF10 forms.

## 🚀 Prerequisites

Make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/)

## 🛠 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/curib123/e-sf10.git
Navigate into the project directory:

bash
Copy code
cd e-sf10
Install dependencies:

bash
Copy code
npm install
Set up environment variables:

Create a .env file in the root directory and add the following:

env
Copy code
REACT_APP_API_BASE_URL=http://localhost:3001/esf10
REACT_APP_API_LOGO_URL=http://localhost:3001
Start the development server:

bash
Copy code
npm start
The app will run at:
http://localhost:3000 (or your configured port)

📌 Notes
Ensure your backend server is running at http://localhost:3001 to handle API requests.

The .env file is required for API endpoints and environment settings.

For production builds, use:

bash
Copy code
npm run build
This will generate an optimized build in the /build directory.

