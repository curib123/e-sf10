import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AddStudent from '../screens/add_students';
import { checkToken } from '../components/token_checker'; 

export default function EditStudentPage() {
  const { lrn } = useParams();
  const [studentData, setStudentData] = useState(null);

    useEffect(() => {
              checkToken();
             }, []);
       
  useEffect(() => {
    const fetchStudent = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) {
        alert("Authorization token missing.");
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/esf10/students/${lrn}/details`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch student.");
        }

        const data = await response.json();
        setStudentData(data.student); 
      } catch (err) {
        alert(`❌ Error: ${err.message}`);
      }
    };

    if (lrn) {
      fetchStudent();
    }
  }, [lrn]);

  return (
    <div className="container-fluid mt-4">
      {studentData ? (
        <AddStudent initialData={studentData} onSubmit={(updated) => console.log("Updated:", updated)} />
      ) : (
        <p>Loading student data...</p>
      )}
    </div>
  );
}
