// this crate returns Result and never panics; snake_case throughout.

#[derive(Debug)]
pub enum MathError {
    DivideByZero,
}

pub fn add(a: i64, b: i64) -> Result<i64, MathError> {
    Ok(a + b)
}
